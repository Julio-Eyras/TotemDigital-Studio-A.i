/**
 * migrate_catch_any_remaining_v7.mjs — SPRINT 6 FASE 4
 *
 * Aplica substituição catch(error:any) → catch(error:unknown) + normalizeError
 * EM TODOS OS ARQUIVOS src (todos os que ainda sobraram)
 * NÃO usa lista TARGETS (diferente do v3 limitado), walk de todo backend/src.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const CWD = process.cwd();

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    const abs = join(dir, f);
    const s = statSync(abs);
    if (s.isDirectory()) {
      if (f !== 'node_modules' && f !== '__tests__' && f !== 'dist' && f !== '.git') walk(abs, acc);
    } else if (f.endsWith('.ts')) acc.push(abs);
  }
  return acc;
}

const NORMALIZE_IMPORT_PATH = (fromDir) => {
  const target = resolve(CWD, 'backend/src/utils/errors.ts');
  const utilsPath = resolve(CWD, 'backend/src/utils');
  let rel = relative(dirname(fromDir), utilsPath).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return `${rel}/errors`;
};

const PERIGO_PATTERNS = [
  /error\s*instanceof\s+(?!Error)(?!RangeError)(?!TypeError)(?!SyntaxError)(?!ReferenceError)\w+/,
  /CustomError|BusinessRule|DomainError|ServiceError|ValidationError|AuthError|NotFoundError|PermissionError|ConflictError|BillingError/,
];

let totalBlocks = 0;
let totalFiles = 0;
let perigosos = [];

const files = walk(resolve(CWD, 'backend/src'));

for (const f of files) {
  let original = readFileSync(f, 'utf-8');
  if (!/catch\s*\(\s*error\s*:\s*any\s*\)/.test(original)) continue;
  let c = original;
  let blocksFile = 0;
  let perigosoFile = false;

  // Substituir catch(error:any) → catch(error: unknown) { const e = normalizeError(error);
  c = c.replace(/catch\s*\(\s*error\s*:\s*any\s*\)\s*\{/g, (match) => {
    blocksFile++;
    return 'catch (error: unknown) {\n      const e = normalizeError(error);';
  });

  // Mapear refs error → equivalentes via e
  c = c.replace(/\berror\.message\b/g, 'e.message');
  c = c.replace(/\berror\.code\b/g, 'e.code');
  c = c.replace(/\berror\.name\b/g, 'e.error.name');
  c = c.replace(/\berror\.stack\b/g, 'e.error.stack');
  c = c.replace(/\berror\.cause\b/g, 'e.error.cause');
  c = c.replace(/\berror\.statusCode\b/g, 'e.statusCode');
  c = c.replace(/\berror\.detail\b/g, '(e.raw as { detail?: string })?.detail');
  c = c.replace(/\berror\.constraint\b/g, '(e.raw as { constraint?: string })?.constraint');
  c = c.replace(/\berror\.table\b/g, '(e.raw as { table?: string })?.table');
  c = c.replace(/\berror\.column\b/g, '(e.raw as { column?: string })?.column');
  c = c.replace(/\berror\?\./g, 'e.raw as any)?.');
  c = c.replace(/\bthrow\s+error\b/g, 'throw e.error');
  c = c.replace(/\breject\(\s*error\s*\)/g, 'reject(e.error)');
  c = c.replace(/\bresolve\(\s*error\s*\)/g, 'resolve(e.error)');
  c = c.replace(/Promise\.reject\(\s*error\s*\)/g, 'Promise.reject(e.error)');
  c = c.replace(/\bnext\(\s*error\s*\)/g, 'next(e.error)');
  c = c.replace(/logError\(\s*([^,]+?),\s*error\s*\)/g, 'logError($1, e.error)');
  c = c.replace(/logError\(\s*([^,]+?),\s*error\s*,/g, 'logError($1, e.error,');
  c = c.replace(/logWarn\(\s*([^,]+?),\s*error\s*\)/g, 'logWarn($1, e.error)');
  c = c.replace(/logWarn\(\s*([^,]+?),\s*error\s*,/g, 'logWarn($1, e.error,');
  c = c.replace(/JSON\.stringify\(\s*error\s*\)/g, 'JSON.stringify(e.raw as object)');
  c = c.replace(/\$\{\s*error\s*\}/g, '${e.message}');
  c = c.replace(/\$\{\s*error\s*\./g, '${e.');
  c = c.replace(/Object\.keys\(\s*error\s*\)/g, 'Object.keys(e.raw as object)');
  c = c.replace(/\.\.\.error\b/g, '...(e.raw as object)');
  c = c.replace(/catch\s*\(\s*e\s*:\s*any\s*\)\s*\{/g, 'catch (eCatch: unknown) { const e = normalizeError(eCatch);');

  // Detectar perigoso
  for (const p of PERIGO_PATTERNS) {
    if (p.test(c)) { perigosoFile = true; perigosos.push({ file: f, pattern: p.toString() }); break; }
  }

  // Adicionar import se ausente
  if (!/import\s*\{[^}]*normalizeError[^}]*\}\s*from\s*['"][^'"]*errors['"]/.test(c)) {
    const lastImport = [...c.matchAll(/^import\s+.*from\s+['"].*['"];?\s*$/gm)].pop();
    if (lastImport) {
      const insPos = lastImport.index + lastImport[0].length;
      const normImpPath = NORMALIZE_IMPORT_PATH(f);
      c = c.slice(0, insPos) + `\nimport { normalizeError } from '${normImpPath}';` + c.slice(insPos);
    }
  }

  if (c !== original) {
    writeFileSync(f, c, 'utf-8');
    totalBlocks += blocksFile;
    totalFiles++;
  }
}

console.log(`===== RESUMO SPRINT 6 FASE 4 (v7) =====`);
console.log(`Total de blocos substituídos: ${totalBlocks}`);
console.log(`Arquivos processados: ${totalFiles}`);
if (perigosos.length > 0) {
  console.log(`Blocos potencialmente perigosos (revisar manual):`);
  for (const p of perigosos.slice(0, 30)) console.log(`  - ${p.file} :: ${p.pattern}`);
  if (perigosos.length > 30) console.log(`  ... +${perigosos.length - 30}`);
} else {
  console.log(`Nenhum bloco perigoso.`);
}
