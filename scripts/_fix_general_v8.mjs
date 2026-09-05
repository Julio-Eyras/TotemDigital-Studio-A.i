import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = resolve(process.cwd(), 'backend/src');
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

const files = walk(ROOT);
let totalFixes = 0;
const fixedFiles = new Set();

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  let changed = false;

  // 1. Padrão: return/valor; // comentário} catch → newline antes de }
  let src2 = src.replace(/;\s*(\/\/[^\n]*?)\}(\s*catch\s*\()/g, (m, comment, catchPart) => {
    changed = true; totalFixes++;
    return `; ${comment}\n    }${catchPart}`;
  });

  // 2. Padrão: return/valor;} catch → newline antes de }
  src2 = src2.replace(/;\}(\s*catch\s*\()/g, (m, catchPart) => {
    changed = true; totalFixes++;
    return `;\n    }${catchPart}`;
  });

  // 3. Padrão: catch(xxx: any) → catch(xxx: unknown)
  src2 = src2.replace(/catch\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*any\s*\)/g, (m, varName) => {
    changed = true; totalFixes++;
    return `catch (${varName}: unknown)`;
  });

  // 4. Padrão: e.raw as any)?.message (parêntese esquerdo faltante)
  src2 = src2.replace(/: (e\.raw as any)\)\?\.message/g, () => {
    changed = true; totalFixes++;
    return `: ((e.raw as { message?: string })?.message)`;
  });
  src2 = src2.replace(/, (e\.raw as any)\)\?\.message/g, () => {
    changed = true; totalFixes++;
    return `, ((e.raw as { message?: string })?.message)`;
  });
  src2 = src2.replace(/\((e\.raw as any)\)\?\.message/g, () => {
    changed = true; totalFixes++;
    return `((e.raw as { message?: string })?.message`;
  });

  // 4b. e.raw as any)?.code
  src2 = src2.replace(/(e\.raw as any)\)\?\.code/g, () => {
    changed = true; totalFixes++;
    return `((e.raw as { code?: string })?.code)`;
  });

  // 4c. e.raw as any)?.detail
  src2 = src2.replace(/(e\.raw as any)\)\?\.detail/g, () => {
    changed = true; totalFixes++;
    return `((e.raw as { detail?: string })?.detail)`;
  });

  // 4d. e.raw as any)?.constraint
  src2 = src2.replace(/(e\.raw as any)\)\?\.constraint/g, () => {
    changed = true; totalFixes++;
    return `((e.raw as { constraint?: string })?.constraint)`;
  });

  // 4e. e.raw as any)?.table
  src2 = src2.replace(/(e\.raw as any)\)\?\.table/g, () => {
    changed = true; totalFixes++;
    return `((e.raw as { table?: string })?.table)`;
  });

  // 5. Remover imports unused normalizeError: se arquivo tem import mas NENHUM uso de normalizeError
  const hasNormalizeImport = /import\s*\{\s*normalizeError\s*\}[^;]*;\n?/m.test(src2);
  const usesNormalize = /normalizeError\s*\(/.test(src2);
  if (hasNormalizeImport && !usesNormalize) {
    src2 = src2.replace(/import\s*\{\s*normalizeError\s*\}[^;]*;\n?/m, () => {
      changed = true; totalFixes++;
      return '';
    });
    // Remover imports * as fsPkg se não for usado
  }
  const hasFsPkgImport = /import\s+\*\s+as\s+fsPkg\s+from\s+['"]fs['"];?\n?/m.test(src2);
  const usesFsPkg = /\bfsPkg\./.test(src2);
  if (hasFsPkgImport && !usesFsPkg) {
    src2 = src2.replace(/import\s+\*\s+as\s+fsPkg\s+from\s+['"]fs['"];?\n?/m, () => {
      changed = true; totalFixes++;
      return '';
    });
  }

  if (changed) {
    writeFileSync(f, src2, 'utf8');
    fixedFiles.add(f);
  }
}

console.log(`===== FIX v8 Geral =====`);
console.log(`Total fixes aplicados: ${totalFixes}`);
console.log(`Arquivos atualizados: ${fixedFiles.size}`);
for (const f of fixedFiles) {
  console.log(' -', f.replace(ROOT + '\\', ''));
}
