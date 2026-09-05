#!/usr/bin/env node
// Script: _fix_final_remaining_11errors.mjs
// Corrige os 11 erros finais (6 TS1003 refs acumuladas e.e.e + 5 TS1472 catch inline restantes)
// Passo 1: Substituir TODO padrao `e.e.(...)` / `e.e.e.e.(...)` por uma expressao limpa
//          Para acessar stack do erro original: usar `e.error.stack` (pois normalizeError retorna .error = Error garantido)
// Passo 2: Reaplicar script de catch inline (v7) para garantir que nao ha } catch colado

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
let fixesPasso1 = 0;
let filesPasso1 = 0;
for (const absFile of allFiles) {
  let src = fs.readFileSync(absFile, 'utf8');
  const before = src;
  // Padrão:   e.e.(qualquer coisa)  | e.e.e.(qualquer) | e.e.e.e.e.(qualquer coisa)
  // Substituir onde o conteudo do parenteses apos os pontos e.e for o cast:
  // Ex.: e.e.e.e.e.(e.raw as { stack?: string })?.stack  ->  e.error.stack
  // Outro: e.e.(e.raw as { stack?: string })?.stack  ->  e.error.stack
  const reAcum = /e(?:\.e){1,10}\(\s*e\.raw\s+as\s*\{\s*stack\?:\s*string\s*\}\s*\)\?\.stack/g;
  const novo1 = src.replace(reAcum, 'e.error.stack');
  if (novo1 !== src) {
    const m = novo1.match(/e\.error\.stack/g);
    fixesPasso1 += (m ? m.length : 0);
    src = novo1;
  }
  // Caso geral:  e.e.message / e.e.code  (nao pegos acima)
  const reGeral = /e(?:\.e)+\.(error|message|code|statusCode|raw)/g;
  const novo2 = src.replace(reGeral, (match, prop) => `e.${prop}`);
  if (novo2 !== src) {
    const dif = (src.match(reGeral) || []).length;
    fixesPasso1 += dif;
    src = novo2;
  }

  if (src !== before) {
    fs.writeFileSync(absFile, src, 'utf8');
    filesPasso1++;
  }
}

console.log(`[_fix_final_11] PASSO 1 (refs e.e. acumuladas):`);
console.log(`  - Refs corrigidas     : ${fixesPasso1}`);
console.log(`  - Arquivos afetados   : ${filesPasso1}`);

// --- Passo 2: reaplicar v7 catch inline 5 locais restantes ---
let fixesPasso2 = 0;
let filesPasso2 = 0;
for (const absFile of allFiles) {
  let src = fs.readFileSync(absFile, 'utf8');
  const before = src;
  const reInline = /([^\n\}])\s*\}[\ \t]*catch[\ \t]*\(([^)]*)\)[\ \t]*\{/g;
  const novo = src.replace(reInline, (_m, beforeStr, args) => {
    const linesBefore = String(beforeStr).split('\n');
    const lastLine = linesBefore[linesBefore.length - 1];
    const mId = lastLine.match(/^([\ \t]*)/);
    fixesPasso2++;
    return `${beforeStr}\n${mId ? mId[1] : ''}} catch (${args}) {`;
  });
  if (novo !== before) {
    fs.writeFileSync(absFile, novo, 'utf8');
    filesPasso2++;
  }
}
console.log(`[_fix_final_11] PASSO 2 (} catch inline separados):`);
console.log(`  - Separacoes efetuadas: ${fixesPasso2}`);
console.log(`  - Arquivos afetados   : ${filesPasso2}`);
