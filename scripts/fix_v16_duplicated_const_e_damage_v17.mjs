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

let filesFixed = 0;
let totalFixes = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;
  let changed = false;

  // Padrão 1: const e = normalizeError(X  const e = normalizeError(X); )
  // -> Resultado de 2 inserções concatenadas. Trocar por 1 const e = normalizeError(X);
  // Regex: captura: const e = normalizeError(\w+\s*const e = normalizeError(\w+)\);\);
  const pat1 = /const\s+e\s*=\s*normalizeError\(\s*(\w+)\s*const\s+e\s*=\s*normalizeError\(\s*\1\s*\)\s*;\s*\)\s*;/g;
  let m1;
  while ((m1 = pat1.exec(content)) !== null) {
    const full = m1[0];
    const param = m1[1];
    const newStr = `const e = normalizeError(${param});`;
    content = content.replace(full, newStr);
    changed = true;
    totalFixes++;
  }

  // Padrão 2: ...\s+(con|c|co|cons)\s+const e = normalizeError(X);\s*
  // Em seguida na outra linha: st e = normalizeError(X);
  // Ou quebras de linha no meio:  "con  const..." \n "st e = ..."
  // Tratar regex multilinha: (const parcial)\s*(?=const e = normalizeError) ... + \n st e = normalizeError
  const pat2 = /\b(con|c|co|cons|co\s*n|t\s*e\s*=|t\s*=)\s+const\s+e\s*=\s*normalizeError\(\s*(\w+)\s*\)\s*;\s*\n\s*st\s+e\s*=\s*normalizeError\(\s*\2\s*\)\s*;/g;
  let m2;
  while ((m2 = pat2.exec(content)) !== null) {
    const full = m2[0];
    const param = m2[2];
    const newStr = `const e = normalizeError(${param});`;
    content = content.replace(full, newStr);
    changed = true;
    totalFixes++;
  }

  // Padrão 3: erro(  const e = normalizeError(error);\nr);
  // Ex: players.ts 131: normalizeError(erro  const e = normalizeError(error);\nr);
  const pat3 = /normalizeError\(\s*(\w+)\s*const\s+e\s*=\s*normalizeError\(\s*\w+\s*\)\s*;\s*\n\s*(\w+)\s*\)\s*;/g;
  let m3;
  while ((m3 = pat3.exec(content)) !== null) {
    const full = m3[0];
    // Resultado esperado: const e = normalizeError(errorParam);
    const param1 = m3[1];
    const param2 = m3[2];
    const param = param1.startsWith(param2.substr(0, param2.length - 1)) ? param2 : param1;
    const newStr = `const e = normalizeError(${param});`;
    content = content.replace(full, newStr);
    changed = true;
    totalFixes++;
  }

  // Padrão 4: linha única de duplicação sem quebra
  const pat4 = /const\s+e\s*=\s*normalizeError\(\s*(\w+)\s*\)\s*;\s*const\s+e\s*=\s*normalizeError\(\s*\1\s*\)\s*;/g;
  let m4;
  while ((m4 = pat4.exec(content)) !== null) {
    const full = m4[0];
    const param = m4[1];
    const newStr = `const e = normalizeError(${param});`;
    content = content.replace(full, newStr);
    changed = true;
    totalFixes++;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    filesFixed++;
  }
}

console.log(`v17 (corrige duplicação v16 const e):`);
console.log(`  - Arquivos consertados: ${filesFixed}`);
console.log(`  - Total de duplicações removidas: ${totalFixes}`);
