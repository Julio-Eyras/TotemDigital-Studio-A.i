#!/usr/bin/env node
// Script: _fix_v7_inline_damage_v10.mjs
// Reverte o dano colateral do script _fix_all_catch_inline_v7.mjs.
// O v7, ao separar `statement} catch`, nao tratou dois casos importantes:
// (A) Quando a LINHA DO TRY tem `const e = normalizeError(error);} catch (...)`
//     -> o `const e` ficou colado ANTES do `}` e portanto FORA do bloco catch!
// (B) Quando a LINHA DO CATCH tem fechamento `{` da abertura seguido IMEDIATAMENTE de codigo
//     sem newline (ex.: `} catch (x:u) { logX(x); }`)
// Este script conserta (A) e (B) em TODO o backend.
// Modo: node scripts/_fix_v7_inline_damage_v10.mjs

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
let totSeparacoes = 0;
let arqs = 0;
for (const absFile of allFiles) {
  let src = fs.readFileSync(absFile, 'utf8');
  const before = src;
  // Padrao (A) e (B) combinados:
  //   `(algum codigo opcional)}[ \t]*catch(...) {[ \t]*(algum codigo nao-vazio opcional)[ \t]*`
  // no MESMA linha.
  //
  // O regex a seguir processa o arquivo LINHA POR LINHA (pois newlines importam para a separacao).
  const lines = src.split(/\r?\n/);
  const outLines = [];
  let separou = 0;
  const re = /^(.*?)(\S[^\n]*?)\s*\}[\ \t]*catch[\ \t]*\(\s*([A-Za-z_$][\w$]*)\s*:\s*unknown\s*\)\s*\{\s*(.*?)\s*$/;
  for (let l = 0; l < lines.length; l++) {
    const ln = lines[l];
    const m = ln.match(re);
    if (m) {
      const _before = m[1];
      const preCode = m[2]; // codigo antes do }
      const arg = m[3];
      const postCode = m[4]; // codigo depois do {

      // Determinar indentacao base da linha
      const indentMatch = (_before + preCode).match(/^([\ \t]*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';
      const bodyIndent = baseIndent + '  ';

      // 1) Emissao da PRIMEIRA parte: codigo antes de }, e o FECHAMENTO da chave do try
      if (preCode.trim().length > 0) {
        outLines.push(`${_before}${preCode}`);
      } else if (_before.trim().length > 0) {
        outLines.push(_before.replace(/\s+$/,''));
      }
      outLines.push(`${baseIndent}} catch (${arg}: unknown) {`);
      // 2) Se postCode nao vazio -> emitir em linha nova com indentacao de corpo
      if (postCode.trim().length > 0) {
        outLines.push(`${bodyIndent}${postCode.trim()}`);
      }
      separou++;
    } else {
      outLines.push(ln);
    }
  }
  const novo = outLines.join('\n');
  if (novo !== src) {
    const finalSrc = before.includes('\r\n') ? novo.replace(/\n/g, '\r\n') : novo;
    fs.writeFileSync(absFile, finalSrc, 'utf8');
    totSeparacoes += separou;
    arqs++;
  }
}
console.log(`[v10-fix-v7-damage] CONCLUIDO`);
console.log(`  - Arquivos modificados   : ${arqs}`);
console.log(`  - Separacoes aplicadas   : ${totSeparacoes}`);
