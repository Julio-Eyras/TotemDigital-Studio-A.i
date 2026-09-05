#!/usr/bin/env node
// Script: _cleanup_master_v8_passob.mjs
// Reverte o Passo B incorreto do master-v8:
// Remove TUDO que foi inserido como `const e = normalizeError(X)` onde o nome X do
// parametro do catch nao corresponde (X nao eh "error"), ou seja, a referencia a `error`
// dentro de normalizeError(...) iria dar TS2552.
// Logica: para cada bloco catch (ARG: unknown), se existe linha const e = normalizeError(NAME)
// onde NAME !== ARG e NAME nao eh uma referencia valida no corpo do catch, REMOVER essa linha.
// Tambem remove `const e = normalizeError(error)` quando ARG !== "error" (confirmando bug).
// Depois de limpar, reexecuta v4 (refs error.* -> e.*) e v6 (unused consts + cast raw) para estado bom.

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd());
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend', 'src');

function walkTs(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkTs(full, out);
    else if (e.isFile() && /\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name))
      out.push(full);
  }
  return out;
}

function findCatchBlocks(lines) {
  const blocks = [];
  const N = lines.length;
  for (let i = 0; i < N; i++) {
    const line = lines[i];
    const re = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*:\s*unknown\s*\)\s*\{/;
    const match = line.match(re);
    if (!match) continue;
    const argName = match[1];
    let openBraceLine = i;
    let braceCol = line.indexOf('{');
    if (braceCol === -1) {
      openBraceLine = i + 1;
      braceCol = lines[i + 1] ? lines[i + 1].indexOf('{') : -1;
    }
    let depth = 0, started = false, endLine = openBraceLine;
    scan: for (let l = openBraceLine; l < N; l++) {
      const ln = lines[l] || '';
      for (let c = 0; c < ln.length; c++) {
        if (l === openBraceLine && c < braceCol && !started) continue;
        const ch = ln[c];
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') {
          depth--; started = true;
          if (depth === 0) { endLine = l; break scan; }
        }
      }
    }
    const bodyStart = openBraceLine + ((braceCol === lines[openBraceLine].length - 1) ? 1 : 0);
    blocks.push({ catchLineIdx: i, argName, startLine: openBraceLine, endLine, bodyStart });
  }
  return blocks;
}

const allFiles = walkTs(BACKEND_SRC);
let linhasRemovidas = 0;
let arqsModif = 0;

for (const absFile of allFiles) {
  const orig = fs.readFileSync(absFile, 'utf8');
  const lines = orig.split(/\r?\n/);
  const linesMut = lines.slice();
  const blocks = findCatchBlocks(linesMut);
  const remocoes = [];
  for (const blk of blocks) {
    // Procurar linhas no corpo [bodyStart, endLine] com: ^const\s+(\w+)\s*=\s*normalizeError\s*\((\w+)\)\s*;
    for (let l = blk.bodyStart; l <= blk.endLine; l++) {
      const m = (linesMut[l] || '').match(/^([\ \t]*)const\s+([A-Za-z_$][\w$]*)\s*=\s*normalizeError\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*;?\s*$/);
      if (!m) continue;
      const _indent = m[1];
      const newName = m[2];
      const argRef = m[3];
      // Se: argRef !== blk.argName  E  (argRef === "error" e blk.argName !== "error") -> bug do PassoB
      // OU: newName === blk.argName (self-shadow, inutil)
      // OU: argRef nao esta definido em lugar nenhum do escopo... praticamente, se
      // argRef != blk.argName, remover com segurança.
      if (argRef !== blk.argName) {
        remocoes.push(l);
      }
    }
  }
  // Remover de tras pra frente
  remocoes.sort((a, b) => b - a);
  const uniq = [...new Set(remocoes)];
  for (const idx of uniq) linesMut.splice(idx, 1);
  const newContent = linesMut.join('\n');
  if (newContent !== orig) {
    const final = orig.includes('\r\n') ? newContent.replace(/\n/g, '\r\n') : newContent;
    fs.writeFileSync(absFile, final, 'utf8');
    linhasRemovidas += uniq.length;
    arqsModif++;
  }
}

console.log(`[cleanup-masterv8-passob] CONCLUIDO`);
console.log(`  - Arquivos modificados   : ${arqsModif}`);
console.log(`  - Linhas bugadas removids: ${linhasRemovidas}`);
