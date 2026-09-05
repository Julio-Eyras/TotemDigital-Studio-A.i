#!/usr/bin/env node
// Script: _cleanup_v2_broken_imports.mjs
// Passo 1: Remover TODO e QUALQUER `import { normalizeError } from '<path>';`
//         inserido pelo v2, para limpar o estado.
// Passo 2: Remover ocorrencias do mesmo import que foram inseridos DENTRO
//         de blocos import { ... } de multi-linha (bug TS1003).
// Modo: node scripts/_cleanup_v2_broken_imports.mjs

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

const allFiles = walkTs(BACKEND_SRC);
let totalFixed = 0;
let totalInsideBlockRemoved = 0;
let totalStandaloneRemoved = 0;

for (const absFile of allFiles) {
  let content = fs.readFileSync(absFile, 'utf8');
  const orig = content;

  // 1) Remover linhas standalone exatas: "import { normalizeError } from '...';"
  //    Onde o path contem "errors" ou "utils/errors"
  const standaloneRe = /^[ \t]*import\s*\{\s*normalizeError\s*\}\s*from\s*['"][^'"]*\/errors['"][ \t]*;[ \t]*$/gm;
  const matches1 = content.match(standaloneRe);
  if (matches1) totalStandaloneRemoved += matches1.length;
  content = content.replace(standaloneRe, '');

  // 2) Remover linhas inseridas DENTRO de blocos multi-linha:
  //    Cenário:
  //      import {
  //      import { normalizeError } from '...';     <- REMOVER
  //        X, Y,
  //      } from '...';
  const insideBlockRe =
    /(^[ \t]*import\s*\{[\s\S]*?)(^[ \t]*import\s*\{\s*normalizeError\s*\}\s*from\s*['"][^'"]*['"][ \t]*;[ \t]*\n)/gm;
  const matches2 = content.match(insideBlockRe);
  if (matches2) totalInsideBlockRemoved += matches2.length;
  content = content.replace(insideBlockRe, '$1');

  // 3) Cleanup de linhas vazias consecutivas >= 3 -> 2 linhas
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== orig) {
    fs.writeFileSync(absFile, content, 'utf8');
    totalFixed++;
  }
}

console.log(`[cleanup-v2-broken] CONCLUIDO`);
console.log(`  - Arquivos modificados   : ${totalFixed}`);
console.log(`  - Linhas standalone rems : ${totalStandaloneRemoved}`);
console.log(`  - Linhas dentro bloco rm : ${totalInsideBlockRemoved}`);
