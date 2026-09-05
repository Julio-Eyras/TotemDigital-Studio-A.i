import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = resolve(process.cwd(), 'backend/src');
const ERRORS_PATH = resolve(ROOT, 'utils/errors.ts');
const exts = ['.ts'];
const skipDirs = new Set(['node_modules', '__tests__', 'dist', '.git']);

function walk(dir, out = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const p = resolve(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (skipDirs.has(entry)) continue;
      walk(p, out);
    } else if (s.isFile() && exts.some(e => entry.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

function relImportFor(fileAbs) {
  const fromDir = dirname(fileAbs).split(sep);
  const toDir = dirname(ERRORS_PATH).split(sep);
  let i = 0;
  while (i < fromDir.length && i < toDir.length && fromDir[i] === toDir[i]) i++;
  const updirs = fromDir.length - i;
  let rel = '';
  for (let k = 0; k < updirs; k++) rel += '../';
  const rest = toDir.slice(i).join('/');
  if (rest) rel += rest + '/';
  rel += 'errors';
  return rel;
}

const files = walk(ROOT);
let nFiles = 0;
let nFixes = 0;

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  let changed = false;

  // 1. Remover TODOS os imports de normalizeError
  const hasNorm = /import\s*\{\s*normalizeError\s*\}[^;]*;\n?/g.test(src);
  if (hasNorm) {
    src = src.replace(/import\s*\{\s*normalizeError\s*\}[^;]*;\n?/g, () => { nFixes++; changed = true; return ''; });
  }

  // 2. Remover usages de normalizeError no arquivo? Não! Se tiver usado, voltar import.
  // Verifica se arquivo usa normalizeError()
  const usesNorm = /normalizeError\s*\(/.test(src);
  if (usesNorm && hasNorm) {
    // Precisa re-adicionar. Calcular lugar.
    const correctRel = relImportFor(f);
    const importLine = `import { normalizeError } from '${correctRel}';\n`;
    // Encontrar grupo de imports no início: depois da última linha começando com import
    const endOfImports = src.search(/\n(?!import\s)/);
    if (endOfImports > -1) {
      src = src.slice(0, endOfImports + 1) + importLine + src.slice(endOfImports + 1);
    } else {
      src = importLine + src;
    }
    nFixes++;
    changed = true;
  }

  // 3. Corrigir e.e.error → e.error
  let bef = src.length;
  src = src.replace(/\be\.e\.error\b/g, 'e.error');
  src = src.replace(/\be\.e\.(raw|code|message|statusCode|detail|constraint|table|column|stack)\b/g, 'e.$1');
  if (src.length !== bef) { changed = true; nFixes++; }

  // 4. Remover fsPkg não usado (opcional, para reduzir TS6133)
  const hasFsPkg = /import\s+\*\s+as\s+fsPkg\s+from\s+['"]fs['"];?\n?/m.test(src);
  if (hasFsPkg && !/\bfsPkg\./.test(src)) {
    src = src.replace(/import\s+\*\s+as\s+fsPkg\s+from\s+['"]fs['"];?\n?/m, '');
    nFixes++;
    changed = true;
  }

  // 5. Remover Metadata não usado (TS6133 remoteCommandService)
  const hasMeta = /import\s*\{\s*Metadata\s*\}[^;]*;?\n?/m.test(src);
  if (hasMeta && !/\bMetadata\b/.test(src.split(/import\s*\{\s*Metadata\s*\}[^;]*;?\n?/)[1] || '')) {
    src = src.replace(/import\s*\{\s*Metadata\s*\}[^;]*;?\n?/m, '');
    nFixes++;
    changed = true;
  }

  if (changed) {
    writeFileSync(f, src, 'utf8');
    nFiles++;
  }
}

console.log('===== PÓS-V8 SUPER LIMPEZA =====');
console.log('Arquivos modificados:', nFiles);
console.log('Total fixes:', nFixes);
