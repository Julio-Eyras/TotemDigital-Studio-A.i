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
let replaced = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

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
    catches.push({
      param: m[1],
      open: braceOpenIdx,
      close: i - 1
    });
  }

  catches.sort((a, b) => b.open - a.open);
  let changed = false;

  for (const blk of catches) {
    let body = content.slice(blk.open + 1, blk.close);
    const hasConstEPattern = new RegExp(`const\\s+e\\s*=\\s*normalizeError\\s*\\(\\s*${blk.param}\\s*\\)`);
    if (hasConstEPattern.test(body) && blk.param !== 'e') {
      // Trocar blk.param.X -> e.X, e blk.param?.X -> e.X
      const directProp = new RegExp(`\\b${blk.param}(\\?)?\\.(message|stack|code|name|detail|constraint)\\b`, 'g');
      let matches = 0;
      body = body.replace(directProp, (_m, _q, prop) => {
        matches++;
        if (prop === 'message') return 'e.message';
        if (prop === 'stack') return 'e.error.stack';
        if (prop === 'code') return '(e.raw as { code?: string })?.code';
        if (prop === 'name') return 'e.error.name';
        if (prop === 'detail') return '((e.raw as { detail?: string })?.detail)';
        if (prop === 'constraint') return '((e.raw as { constraint?: string })?.constraint)';
        return _m;
      });
      // Trocar blk.param.raw como parametro (não é prop)
      if (matches > 0) {
        replaced += matches;
        content = content.slice(0, blk.open + 1) + body + content.slice(blk.close);
        changed = true;
      }
    }
  }

  if (changed && content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}
console.log(`v19 (troca param.X → e.X apenas quando já há const e = normalizeError(param)):`);
console.log(`  - Arquivos modificados: ${filesModified}`);
console.log(`  - Refs param.* trocadas: ${replaced}`);
