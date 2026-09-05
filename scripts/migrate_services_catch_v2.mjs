/**
 * migrate_services_catch_v2.mjs — SPRINT 6 Fase 2
 *
 * Usa helper normalizeError (require import no topo do arquivo) para substituir:
 *   catch (error: any) { ... error.message / logError(..., error) ... }
 * por:
 *   catch (error: unknown) {
 *     const e = normalizeError(error);
 *     ... e.message / logError(..., e.error) ...
 *   }
 *
 * Também injeta automaticamente:
 *   import { normalizeError } from '../utils/errors';
 * se não existir.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const CWD = process.cwd();

const TARGETS = [
  'backend/src/services/totemService.ts',
  'backend/src/services/userService.ts',
  'backend/src/services/twoFactorService.ts',
  'backend/src/services/billingService.ts',
  'backend/src/services/campaignService.ts',
  'backend/src/services/mediaService.ts',
];

const IMPORT_NORMALIZE =
  "import { normalizeError } from '../utils/errors';";

const NORMALIZE_LINE = 'const e = normalizeError(error);';

const CATCH_REGEX = /(\s*)\}\s*catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\n([\s\S]*?\n)\s*\}/g;

function toAbs(p) {
  return resolve(join(CWD, p));
}

function replaceRefs(body) {
  // error?.message → e.message
  let r = body.replace(/\berror\?\.message\b/g, 'e.message');
  // error.message → e.message
  r = r.replace(/\berror\.message\b/g, 'e.message');
  // error.code → e.code
  r = r.replace(/\berror\.code\b/g, 'e.code');
  // error.stack → e.error.stack
  r = r.replace(/\berror\.stack\b/g, 'e.error.stack');
  // logError/logWarn/logInfo(..., error) → (..., e.error)
  r = r.replace(
    /(logError|logWarn|logInfo|console\.log|console\.error|console\.warn)\(([^\n]*?),\s*error\s*\)/g,
    (_m, fn, args) => `${fn}(${args}, e.error)`
  );
  // logError/logWarn/logInfo(..., error, {...}) → (..., e.error, {...})
  r = r.replace(
    /(logError|logWarn|logInfo)\(([^\n]*?),\s*error\s*,\s*\{/g,
    (_m, fn, args) => `${fn}(${args}, e.error, {`
  );
  // throw error → throw e.error
  r = r.replace(/\bthrow\s+error\s*;/g, 'throw e.error;');
  // next(error) → next(e.error)
  r = r.replace(/\bnext\(\s*error\s*\)/g, 'next(e.error);');
  // isDatabaseError(error) → isDatabaseError(e.raw)
  r = r.replace(/\bisDatabaseError\(\s*error\s*\)/g, 'isDatabaseError(e.raw)');
  // isUniqueViolationError(error) → isUniqueViolationError(e.raw)
  r = r.replace(/\bisUniqueViolationError\(\s*error\s*\)/g, 'isUniqueViolationError(e.raw)');
  return r;
}

function detectDangerous(body) {
  // Uso de error.XXX que não temos mapeado (menos message/code/stack e funções conhecidas)
  const badProp = /\berror\.(?!message|code|stack|name|constructor)(\w+)\b/.test(body);
  const errorEq = /\berror\s*[!=]==?/.test(body);
  const errorSpread = /\.\.\.\s*error\b/.test(body);
  return badProp || errorEq || errorSpread;
}

function ensureImport(content, filePath) {
  if (content.includes("from '../utils/errors'") || content.includes('from "./errors"')) {
    return content;
  }
  // Calcula caminho relativo a partir do diretório do arquivo
  const fileDir = dirname(filePath);
  const errorsAbs = resolve(fileDir, '../utils/errors');
  const rel = relative(fileDir, errorsAbs).replace(/\\/g, '/').replace(/\.ts$/, '');
  const importLine = `import { normalizeError } from '${rel}';\n`;

  // Insere após última linha de import {...} from existente
  const importLines = content.match(/^import .+;$/gm) || [];
  if (importLines.length === 0) {
    return importLine + content;
  }
  const lastImport = importLines[importLines.length - 1];
  return content.replace(lastImport, lastImport + '\n' + importLine.replace(/\n$/, ''));
}

function processFile(filePath, rel) {
  if (!existsSync(filePath)) {
    console.log(`[SKIP] Não existe: ${rel}`);
    return { replaced: 0, skipped: [] };
  }

  const original = readFileSync(filePath, 'utf8');
  let content = original;
  const skipped = [];
  let replaced = 0;

  content = content.replace(CATCH_REGEX, (match, closeIndent, body) => {
    if (detectDangerous(body)) {
      const line = (original.slice(0, original.indexOf(match)).match(/\n/g) || []).length + 1;
      skipped.push({ line });
      return match;
    }
    const safeBody = replaceRefs(body);
    replaced += 1;
    const ind = closeIndent.replace(/^[\r\n]+/, '');
    const bodyLines = body.split('\n');
    const firstBody = bodyLines.find((l) => l.trim().length > 0) || bodyLines[0] || '';
    const m2 = firstBody.match(/^(\s*)/);
    const bodyIndent = m2 ? m2[1] : ind + '  ';
    return `${ind}} catch (error: unknown) {\n${bodyIndent}${NORMALIZE_LINE}\n${safeBody}${ind}}`;
  });

  if (replaced > 0) {
    content = ensureImport(content, filePath);
  }

  if (replaced > 0 || skipped.length > 0) {
    writeFileSync(filePath, content, 'utf8');
  }
  return { replaced, skipped };
}

const summary = { files: 0, replaced: 0, skippedBlocks: [] };
for (const rel of TARGETS) {
  const abs = toAbs(rel);
  const r = processFile(abs, rel);
  summary.files += r.replaced + r.skipped.length > 0 ? 1 : 0;
  summary.replaced += r.replaced;
  summary.skippedBlocks.push(...r.skipped.map((s) => ({ file: rel, ...s })));
  console.log(`[${rel}] ${r.replaced} bloco(s) substituído(s); ${r.skipped.length} perigoso(s) preservado(s)`);
}

console.log('\n===== RESUMO SPRINT 6 FASE 2 =====');
console.log(`Total de blocos catch substituídos: ${summary.replaced}`);
console.log(`Arquivos processados: ${summary.files}`);
if (summary.skippedBlocks.length > 0) {
  console.log(`\nBlocos NÃO substituídos (revisar manualmente):`);
  for (const s of summary.skippedBlocks) console.log(`  - ${s.file} ~linha ${s.line}`);
} else {
  console.log('Nenhum bloco perigoso encontrado.');
}
