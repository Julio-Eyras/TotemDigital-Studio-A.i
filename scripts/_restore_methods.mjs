import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const PATH = resolve(process.cwd(), 'backend/src/services/remoteCommandService.ts');
let headContent;
try { headContent = execSync('git show HEAD:backend/src/services/remoteCommandService.ts', { encoding: 'utf8' }); }
catch (e) { console.error('Cannot fetch HEAD'); process.exit(1); }
const cur = readFileSync(PATH, 'utf-8');

// Regex pegar os 3 métodos do HEAD original puros, sem alterações
function extractMethod(src, methodName) {
  const re = new RegExp(`(\\/\\*\\*[\\s\\S]*?\\*\\/\\s*async\\s+${methodName}[\\s\\S]*?)(?=\\n\\s*\\/\\*\\*\\s*\\n\\s*\\*|\\n\\s*private\\s+|\\n\\}\\s*\\n\\/\\/ Singleton|$)`);
  const m = src.match(re);
  return m ? m[0] : null;
}

const mCleanupScreenshots = extractMethod(headContent, 'cleanupOldScreenshots');
const mPrunePerTotem = extractMethod(headContent, 'pruneScreenshotsPerTotem');
const mCleanupCmds = extractMethod(headContent, 'cleanupOldCommands');

console.log('mCleanupScreenshots:', mCleanupScreenshots ? mCleanupScreenshots.length : 'NULL');
console.log('mPrunePerTotem:', mPrunePerTotem ? mPrunePerTotem.length : 'NULL');
console.log('mCleanupCmds:', mCleanupCmds ? mCleanupCmds.length : 'NULL');

// Aplicar manual catch(any) → unknown nos 3 métodos extraídos do HEAD (versão PURA, sem bugs)
function fixOneMethod(raw, fsNameVar) {
  if (!raw) return raw;
  let r = raw;
  // Adicionar import fs no topo do arquivo depois, por enquanto usar await import('fs') que originais têm
  r = r.replace(/catch\s*\(\s*error\s*:\s*any\s*\)/g, 'catch (error: unknown)');
  // Em cada catch block, adicionar const e = normalizeError(error); depois da abertura
  r = r.replace(/catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{/g, 'catch (error: unknown) {\n      const e = normalizeError(error);');
  // logError(..., error,  → ... e.error,
  r = r.replace(/logError\(\s*([^,]+?),\s*error\s*\)/g, 'logError($1, e.error)');
  r = r.replace(/logError\(\s*([^,]+?),\s*error\s*,/g, 'logError($1, e.error,');
  // Renomear `const fs = await import('fs');` → `const ${fsNameVar} = await import('fs');` + usos
  r = r.replace(/const\s+fs\s*=\s*await\s+import\s*\(\s*['"]fs['"]\s*\);?/g, `const ${fsNameVar} = await import('fs');`);
  r = r.replace(/\bfs\.existsSync\b/g, `${fsNameVar}.existsSync`);
  r = r.replace(/\bfs\.promises\.unlink\b/g, `${fsNameVar}.promises.unlink`);
  return r;
}

let newCleanup = fixOneMethod(mCleanupScreenshots, 'fsPkgCleanup');
let newPrune = fixOneMethod(mPrunePerTotem, 'fsPkgPrune');
let newCleanupCmds = fixOneMethod(mCleanupCmds, '_unused');

console.log('--- newCleanup snippet:');
console.log(newCleanup ? newCleanup.slice(0, 200) : 'null');

// Agora encontrar a posição de início de cada método no arquivo CUR e substituir
function findMethodStart(src, methodName) {
  const re = new RegExp(`\\/\\*\\*\\s*\\n\\s*\\*(?:.|\\n)*?(?:Limpa screenshots antigos|Mant.m no m.ximo|Limpa comandos antigos)(?:.|\\n)*?(async\\s+${methodName}\\s*\\()`, 'm');
  const m = src.match(re);
  return m ? m.index + m[0].indexOf('async ') : -1;
}
function findMethodEnd(src, startIdx) {
  // Encontra a chave de abertura da função depois do `{`
  let i = startIdx;
  while (i < src.length && src.charCodeAt(i) !== 123) i++;
  if (i >= src.length) return -1;
  let open = 1;
  i++;
  while (i < src.length && open > 0) {
    const c = src.charCodeAt(i);
    if (c === 123) open++;
    else if (c === 125) { open--; if (open === 0) break; }
    i++;
  }
  return i + 1;
}

const curCleanupStart = findMethodStart(cur, 'cleanupOldScreenshots');
const curPruneStart = findMethodStart(cur, 'pruneScreenshotsPerTotem');
const curCleanupCmdsStart = findMethodStart(cur, 'cleanupOldCommands');
console.log('starts:', curCleanupStart, curPruneStart, curCleanupCmdsStart);

// Extrair comentários JSDoc do CUR (antes do async)
function extractJSDocBefore(src, methodStartIdx) {
  const before = src.slice(0, methodStartIdx);
  const m = before.match(/(\/\*\*[\s\S]*?\*\/)\s*$/);
  return m ? m[0] + '\n  ' : '';
}

const jsDocCleanup = extractJSDocBefore(cur, curCleanupStart);
const jsDocPrune = extractJSDocBefore(cur, curPruneStart);
const jsDocCleanupCmds = extractJSDocBefore(cur, curCleanupCmdsStart);

// Remover o comentário repetido dos métodos extraídos
function stripLeadingComment(text) {
  return text.replace(/^(\/\*\*[\s\S]*?\*\/)\s*\n?/, '');
}
newCleanup = (jsDocCleanup + stripLeadingComment(newCleanup || ''));
newPrune = (jsDocPrune + stripLeadingComment(newPrune || ''));
newCleanupCmds = (jsDocCleanupCmds + stripLeadingComment(newCleanupCmds || ''));

// Aplicar substituições em ordem reversa (do fim para o início)
const subs = [
  [curCleanupStart, findMethodEnd(cur, curCleanupStart), newCleanup],
  [curPruneStart, findMethodEnd(cur, curPruneStart), newPrune],
  [curCleanupCmdsStart, findMethodEnd(cur, curCleanupCmdsStart), newCleanupCmds],
].sort((a, b) => b[0] - a[0]);

let result = cur;
for (const [s, e, txt] of subs) {
  result = result.slice(0, s) + txt + result.slice(e);
}

writeFileSync(PATH, result, 'utf-8');
console.log('Written!');
