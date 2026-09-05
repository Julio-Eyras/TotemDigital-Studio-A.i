import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
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

// Calcula caminho relativo correto de imports para utils/errors.ts
// similar ao v4
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
let totalFixedImports = 0;
let filesWithProblems = [];

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  let changed = false;

  // ===== CORREÇÃO 1: Remover imports NORMALIZEERROR DUPLICADOS =====
  // Coletar todos os imports de normalizeError
  const normImportRe = /^[ \t]*import[ \t]+\{\s*normalizeError\s*\}[ \t]*from[ \t]*['"]([^'"]+)['"][ \t]*;?[ \t]*\n?/gm;
  const importsNorm = [];
  let m;
  while ((m = normImportRe.exec(src))) importsNorm.push({ full: m[0], idx: m.index, path: m[1] });

  if (importsNorm.length > 1) {
    // Remover TODOS e deixar APENAS 1 (o primeiro que aparece e vamos re-adicionar com caminho correto)
    let cleanedImports = src.replace(normImportRe, '');
    const correctRel = relImportFor(f);
    // Adicionar APENAS um import correto (após última linha "import {" final existente, ou no topo se não houver)
    const finalImportRe = /(import[^\n]*\n)(?!.*import[^\n]*\n)/s;
    const newImport = `import { normalizeError } from '${correctRel}';\n`;
    // Encontrar a última linha de import no início do arquivo
    const importBlock = /^((?:[ \t]*import[^\n]*\n)+/m;
    if (cleanedImports.match(importBlock)) {
      cleanedImports = cleanedImports.replace(importBlock, match => match + newImport);
    } else {
      cleanedImports = newImport + cleanedImports;
    }
    src = cleanedImports;
    changed = true;
    filesWithProblems.push(f.replace(ROOT + '\\', '') + ' [normDup removed]');
    totalFixedImports++;
  } else if (importsNorm.length === 1) {
    // ===== CORREÇÃO 2: Caminho INCORRETO de normalizeError (mesmo que 1 import =====
    const only = importsNorm[0];
    const correctRel = relImportFor(f);
    const arq = f.replace(ROOT + '\\', '');
    // Substituições manuais para casos conhecidos
    if (only.path !== correctRel) {
      // Caminho relativo está errado, corrigir
      const re = new RegExp(`import\\s*\\{\\s*normalizeError\\s*\\}\\s*from\\s*['"` + escapeRe(only.path) + "['\"][^;]*;?");
      src = src.replace(re, `import { normalizeError } from '${correctRel}';`);
      changed = true;
      totalFixedImports++;
    }
  }

  // ===== CORREÇÃO 3: e.e.error → e.error (dobrado) =====
  let doubledRe = /\be\.e\.error\b/g;
  if (src.match(doubledRe)) {
    src = src.replace(doubledRe, 'e.error');
    changed = true;
  }
  let doubledRe2 = /\be\.e\.(raw|code|message|statusCode)\b/g;
  if (src.match(doubledRe2)) {
    src = src.replace(doubledRe2, 'e.$1');
    changed = true;
  }

  // ===== CORREÇÃO 4: Imports * as fsPkg duplicados ou errados =====
  // Remover imports fsPkg desnecessários ou corrigir usos que voltar para se tem mais
  // (não fazer por enquanto)

  if (changed) writeFileSync(f, src, 'utf8');
}

console.log('===== PÓS-V8 LIMPEZA GERAL =====');
console.log('Total imports corrigidos (dup/caminho):', totalFixedImports);
console.log('Arquivos com problemas detectados:', filesWithProblems.slice(0, 30));
if (filesWithProblems.length > 30) console.log('... mais', filesWithProblems.length - 30, 'outros...');

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
