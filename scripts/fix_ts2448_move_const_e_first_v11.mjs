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
let blocksMoved = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

  const catchRegex = /}\s*catch\s*\(\s*(\w+)\s*:\s*unknown\s*\)\s*\{/g;
  let match;
  const catches = [];

  while ((match = catchRegex.exec(content)) !== null) {
    const paramName = match[1];
    const startCatchOpenBraceIdx = match.index + match[0].length - 1;

    let depth = 1;
    let i = startCatchOpenBraceIdx + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    const endCatchCloseBraceIdx = i - 1;

    catches.push({
      paramName,
      openBraceIdx: startCatchOpenBraceIdx,
      closeBraceIdx: endCatchCloseBraceIdx,
      body: content.slice(startCatchOpenBraceIdx + 1, endCatchCloseBraceIdx)
    });
  }

  let edits = [];
  for (const blk of catches) {
    const lines = blk.body.split('\n');
    const constERegex = /const\s+e\s*=\s*normalizeError\(\s*(\w+)\s*\)\s*;\s*$/;
    let constELineIdx = -1;
    let constELineContent = null;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (constERegex.test(line.trim())) {
        constELineIdx = li;
        constELineContent = line;
        break;
      }
    }

    if (constELineIdx > 0) {
      const leadingNewlinesMatch = lines[0].match(/^(\s*)$/);
      let firstIdx = 0;
      if (leadingNewlinesMatch) firstIdx = 1;

      if (constELineIdx > firstIdx) {
        const indentMatch = constELineContent.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const correctConstE = `${indent}const e = normalizeError(${blk.paramName});`;

        lines.splice(constELineIdx, 1);
        lines.splice(firstIdx, 0, correctConstE);

        blocksMoved++;
        edits.push({ blk, newBody: lines.join('\n') });
      }
    }
  }

  if (edits.length > 0) {
    edits.sort((a, b) => b.blk.openBraceIdx - a.blk.openBraceIdx);
    for (const edit of edits) {
      const before = content.slice(0, edit.blk.openBraceIdx + 1);
      const after = content.slice(edit.blk.closeBraceIdx);
      content = before + edit.newBody + after;
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}

console.log(`fix v11 (TS2448 move const e first):`);
console.log(`  - Arquivos modificados: ${filesModified}`);
console.log(`  - Blocos catch com const e movida para primeira linha: ${blocksMoved}`);
