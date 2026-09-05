#!/usr/bin/env node
// Script: _cleanup_final_all_bad_consts_v9.mjs
// Remove 100% das linhas "const NOME = normalizeError(X)" inseridas incorretamente pelo
// Passo B do master-v8, identificando-os de forma segura:
// Regra 1: Se dentro de um bloco catch(ARG: unknown), existe linha const Y = normalizeError(X)
//          onde X !== ARG (X nao eh o arg do catch -> referencia a variavel errada!) -> REMOVER.
// Regra 2: Linha const e = normalizeError(error) onde ARG nao eh "error" e nem "e" -> 100% bug do master-v8 -> REMOVER.
// Regra 3: Remover duplicatas se tivermos duas ou mais consts de normalizacao no mesmo bloco.
// Depois da limpeza: reexecutar v4 e v6 para voltar ao estado bom.

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
let totalRemovals = 0;
let arquivosModif = 0;

for (const absFile of allFiles) {
  const orig = fs.readFileSync(absFile, 'utf8');
  const lines = orig.split(/\r?\n/);
  const linesMut = lines.slice();
  // Coletar indices de linhas a remover de TODOS os blocos
  const toRemove = [];
  const blocks = findCatchBlocks(linesMut);

  for (const blk of blocks) {
    const argCatch = blk.argName;
    // Contagem: quantas "const X = normalizeError(...)" existem no bloco?
    const constDefs = [];
    for (let l = blk.bodyStart; l <= blk.endLine; l++) {
      const m = (linesMut[l] || '').match(
        /^[\ \t]*const\s+([A-Za-z_$][\w$]*)\s*=\s*normalizeError\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*;\s*$/
      );
      if (m) constDefs.push({ lineIdx: l, varName: m[1], inputName: m[2] });
    }
    if (constDefs.length === 0) continue;

    // Regra 1: inputName !== argCatch -> REMOVER (referencia variavel errada,
    // certamente linha inserida erroneamente)
    for (const d of constDefs) {
      if (d.inputName !== argCatch) toRemove.push(d.lineIdx);
    }

    // Regra 3: Se apos remover acima ainda existir >=2 constDefs validas (inputName==argCatch),
    //          manter apenas a PRIMEIRA, remover restantes (duplicatas)
    const validsAfterR1 = constDefs.filter(d => d.inputName === argCatch && !toRemove.includes(d.lineIdx));
    if (validsAfterR1.length >= 2) {
      for (let k = 1; k < validsAfterR1.length; k++)
        toRemove.push(validsAfterR1[k].lineIdx);
    }
  }

  // Remover de tras pra frente, com deduplicação
  const uniqRem = [...new Set(toRemove)].sort((a, b) => b - a);
  for (const r of uniqRem) linesMut.splice(r, 1);

  const newSrc = linesMut.join('\n');
  if (newSrc !== orig) {
    const final = orig.includes('\r\n') ? newSrc.replace(/\n/g, '\r\n') : newSrc;
    fs.writeFileSync(absFile, final, 'utf8');
    totalRemovals += uniqRem.length;
    arquivosModif++;
  }
}

console.log(`[cleanup-v9] CONCLUIDO`);
console.log(`  - Arquivos modificados           : ${arquivosModif}`);
console.log(`  - Linhas "const ... = normalizeError" ruins removidas: ${totalRemovals}`);
