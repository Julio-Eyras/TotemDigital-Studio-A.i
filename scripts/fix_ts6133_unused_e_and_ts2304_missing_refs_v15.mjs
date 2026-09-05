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
let unusedRemoved = 0;
let missingRefsAdded = 0;
let missingImportsAdded = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

  // ============================================================
  // PARTE 1 — Remover const e = normalizeError(X); se e não usado no bloco catch (TS6133)
  // ============================================================
  const catchRegex = /catch\s*\(\s*(\w+)\s*:\s*unknown\s*\)\s*\{/g;
  let match;
  const catches = [];
  while ((match = catchRegex.exec(content)) !== null) {
    const catchParamName = match[1];
    const braceOpenIdx = match.index + match[0].length - 1;
    let depth = 1;
    let i = braceOpenIdx + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    const braceCloseIdx = i - 1;
    catches.push({
      catchParamName,
      braceOpen: braceOpenIdx,
      braceClose: braceCloseIdx,
      body: content.slice(braceOpenIdx + 1, braceCloseIdx)
    });
  }

  let edits1 = [];
  for (const blk of catches) {
    // Tem const e = normalizeError(...); no corpo?
    const constERe = /^\s*(const\s+e\s*=\s*normalizeError\(\s*(\w+)\s*\)\s*;)\s*$/m;
    const constEM = blk.body.match(constERe);
    if (constEM) {
      const constELineFull = constEM[1]; // linha completa sem leading whitespace
      // Verificar se no bloco ALGUMA referência a `e.` existe (fora a própria declaração)
      const bodyWOConst = blk.body.replace(constEM[0], '');
      const usesE = /\be\.[a-zA-Z_]/.test(bodyWOConst) || /\be\b[^.\w\s]/.test(bodyWOConst); // e.prop ou e usado
      if (!usesE) {
        // Remover a linha const e inteira (incluindo newline se tiver)
        const startInBlk = blk.body.indexOf(constEM[0]);
        const endInBlk = startInBlk + constEM[0].length;
        // Estender para incluir \n antes ou depois se possivel
        let realStart = startInBlk;
        let realEnd = endInBlk;
        while (realStart > 0 && blk.body[realStart-1] === '\n') realStart--;
        while (realStart > 0 && blk.body[realStart-1] === '\r') realStart--;
        while (realEnd < blk.body.length && (blk.body[realEnd] === '\n' || blk.body[realEnd] === '\r')) realEnd++;
        const before = blk.body.slice(0, realStart);
        const after = blk.body.slice(realEnd);
        const newBody = before + after;
        edits1.push({ blk, newBody });
        unusedRemoved++;
      }
    }
  }
  if (edits1.length > 0) {
    edits1.sort((a, b) => b.blk.braceOpen - a.blk.braceOpen);
    for (const ed of edits1) {
      const before = content.slice(0, ed.blk.braceOpen + 1);
      const after = content.slice(ed.blk.braceClose);
      content = before + ed.newBody + after;
    }
  }

  // ============================================================
  // PARTE 2 — Garantir que const e existe se há refs a `e.` e não há const e (TS2304)
  // ============================================================
  const catches2 = [];
  const catchRegex2 = /catch\s*\(\s*(\w+)\s*:\s*unknown\s*\)\s*\{/g;
  let match2;
  while ((match2 = catchRegex2.exec(content)) !== null) {
    const catchParamName = match2[1];
    const braceOpenIdx = match2.index + match2[0].length - 1;
    let depth = 1;
    let i = braceOpenIdx + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    const braceCloseIdx = i - 1;
    catches2.push({
      catchParamName,
      braceOpen: braceOpenIdx,
      braceClose: braceCloseIdx,
      body: content.slice(braceOpenIdx + 1, braceCloseIdx)
    });
  }
  let edits2 = [];
  for (const blk of catches2) {
    const hasConstE = /const\s+e\s*=\s*normalizeError\s*\(/.test(blk.body);
    const usesE = /\be\.[a-zA-Z_]/.test(blk.body);
    if (usesE && !hasConstE) {
      // Precisa inserir const e = normalizeError(catchParamName); na 1a linha
      const lines = blk.body.split('\n');
      const baseIndent = lines.find(l => l.trim().length > 0)?.match(/^\s*/)?.[0] || '';
      const constE = `${baseIndent}const e = normalizeError(${blk.catchParamName});\n`;
      let firstLine = 0;
      if (lines[0].trim() === '') firstLine = 1;
      lines.splice(firstLine, 0, `${baseIndent}const e = normalizeError(${blk.catchParamName});`);
      edits2.push({ blk, newBody: lines.join('\n') });
      missingRefsAdded++;
    }
  }
  if (edits2.length > 0) {
    edits2.sort((a, b) => b.blk.braceOpen - a.blk.braceOpen);
    for (const ed of edits2) {
      const before = content.slice(0, ed.blk.braceOpen + 1);
      const after = content.slice(ed.blk.braceClose);
      content = before + ed.newBody + after;
    }
  }

  // ============================================================
  // PARTE 3 — Garantir import normalizeError exists se usado no arquivo (TS2304)
  // ============================================================
  if (/normalizeError\s*\(/.test(content)) {
    // Tem chamada de normalizeError no arquivo. Verificar se há import.
    const hasImport = /import\s*\{\s*normalizeError\s*\}\s*from\s*["'][^"']+["']/.test(content);
    if (!hasImport && !file.endsWith(path.join('backend', 'src', 'utils', 'errors.ts'))) {
      // Calcular caminho relativo correto para utils/errors.ts
      const filePathDir = path.dirname(file);
      const errorsPath = path.resolve(BACKEND_SRC, 'utils', 'errors.ts');
      let rel = path.relative(filePathDir, errorsPath);
      rel = rel.replace(/\.ts$/, '');
      if (!rel.startsWith('.')) rel = './' + rel;
      rel = rel.replace(/\\/g, '/');
      // Encontrar local para inserir import: APÓS último import existente
      const lines = content.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*import\s+/.test(lines[i]) || /^\s*import\s*\(/.test(lines[i])) lastImportIdx = i;
      }
      const importLine = `import { normalizeError } from '${rel}';`;
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, importLine);
      } else {
        // Nenhum import: inserir no início, após comentários header
        lines.splice(0, 0, importLine);
      }
      content = lines.join('\n');
      missingImportsAdded++;
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}

console.log(`fix v15 (TS6133 unused e + TS2304 missing e/normalizeError):`);
console.log(`  - Arquivos modificados           : ${filesModified}`);
console.log(`  - Const e unused removidas       : ${unusedRemoved}`);
console.log(`  - Const e faltantes inseridas    : ${missingRefsAdded}`);
console.log(`  - Imports normalizeError faltando: ${missingImportsAdded}`);
