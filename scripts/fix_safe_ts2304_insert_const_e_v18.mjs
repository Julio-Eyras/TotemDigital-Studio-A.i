import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_SRC = path.resolve(__dirname, '..', 'backend', 'src');

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

let filesModified = 0;
let insertedConstE = 0;
let typedUnknown = 0;
let addedImports = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

  // Encontrar TODOS os blocos catch (com parsing de chaves)
  const catches = [];
  const catchRegex = /catch\s*\(\s*(\w+)(\s*:\s*\w+)?\s*\)\s*\{/g;
  let m;
  while ((m = catchRegex.exec(content)) !== null) {
    const braceOpenIdx = m.index + m[0].length - 1;
    let depth = 1;
    let i = braceOpenIdx + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    const braceCloseIdx = i - 1;
    catches.push({
      param: m[1],
      hasType: !!m[2],
      open: braceOpenIdx,
      close: braceCloseIdx
    });
  }

  // Aplicar edições do último para o primeiro (preservar offsets)
  let edits = false;
  catches.sort((a, b) => b.open - a.open);

  for (const blk of catches) {
    // 1. Inserir :unknown se não tiver tipo
    if (!blk.hasType) {
      const beforeClose = content.lastIndexOf(')', blk.open);
      if (beforeClose > 0) {
        content = content.slice(0, beforeClose) + `: unknown` + content.slice(beforeClose);
        blk.close += ' : unknown'.length;
        typedUnknown++;
        edits = true;
      }
    }

    // 2. Verificar se corpo refere e. mas não tem const e
    const body = content.slice(blk.open + 1, blk.close);
    const usesE = /\be\.[a-zA-Z_]/.test(body);
    const hasConstE = /const\s+e\s*=\s*normalizeError\s*\(/.test(body);
    if (usesE && !hasConstE) {
      const lines = body.split('\n');
      let baseIndent = '  ';
      for (const ln of lines) {
        if (ln.trim().length > 0) { baseIndent = ln.match(/^\s*/)?.[0] || baseIndent; break; }
      }
      let insertIdx = 0;
      while (insertIdx < lines.length && lines[insertIdx].trim() === '') insertIdx++;
      lines.splice(insertIdx, 0, `${baseIndent}const e = normalizeError(${blk.param});`);
      const newBody = lines.join('\n');
      content = content.slice(0, blk.open + 1) + newBody + content.slice(blk.close);
      insertedConstE++;
      edits = true;
    }
  }

  // 3. Garantir import normalizeError existe se usado
  if (/normalizeError\s*\(/.test(content)) {
    const hasImport = /import\s*\{\s*normalizeError\s*\}\s*from\s*["'][^"']+["']/.test(content);
    if (!hasImport && !file.endsWith(path.join('backend', 'src', 'utils', 'errors.ts'))) {
      const filePathDir = path.dirname(file);
      const errorsPath = path.resolve(BACKEND_SRC, 'utils', 'errors.ts');
      let rel = path.relative(filePathDir, errorsPath);
      rel = rel.replace(/\.ts$/, '');
      if (!rel.startsWith('.')) rel = './' + rel;
      rel = rel.replace(/\\/g, '/');
      const lines = content.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*import\s+/.test(lines[i])) lastImportIdx = i;
      }
      const importLine = `import { normalizeError } from '${rel}';`;
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, importLine);
      } else {
        lines.splice(0, 0, importLine);
      }
      content = lines.join('\n');
      addedImports++;
      edits = true;
    }
  }

  if (edits && content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}

console.log(`v18 (só insere const e quando refs a e. existem sem const):`);
console.log(`  - Arquivos modificados : ${filesModified}`);
console.log(`  - Catch params tipados : ${typedUnknown}`);
console.log(`  - Const e inseridas    : ${insertedConstE}`);
console.log(`  - Imports adicionados  : ${addedImports}`);
