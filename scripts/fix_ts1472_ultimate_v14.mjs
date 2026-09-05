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
let totalFixed = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

  // PADRÃO A — qualquer sequência não-newline seguida de } com 0+ whitespace/r/n + catch (
  //  Para capturar casos: comentario}catch, ;}catch, return X}catch, mesmo com \r no meio
  //  Usamos DOT-NEWLINE exclusivo: capturar qualquer caractere MENOS newline, seguido por }catch.
  //  Mas também casos onde } aparece DUAS vezes: }}catch.
  const patternA = /([^\n\r])[ \t\r]*(\}+)[ \t\r]*(catch\s*\()/g;
  let matches = content.match(patternA);
  if (matches && matches.length > 0) {
    content = content.replace(patternA, (m, beforeChar, braces, catchStr) => {
      totalFixed += braces.length;
      return `${beforeChar}\n${braces} ${catchStr}`;
    });
  }

  // PADRÃO B — Mesmo que A, mas quando beforeChar for um } também (ex: }}}catch)
  //  Cobrir casos onde 3+ chaves coladas e catch segue imediatamente.
  const patternB = /(\}+)(\}+catch\s*\()/g;
  matches = content.match(patternB);
  if (matches && matches.length > 0) {
    content = content.replace(patternB, (m, b1, b2) => {
      totalFixed++;
      return `${b1}\n${b2}`;
    });
  }

  // PADRÃO C — Linha que termina com \r\n e a linha é: QUALQUER COISA, e } na mesma linha seguido de catch
  //  Cobrir Windows CRLF. Já é coberto por A por tirar o \r dos negados, mas reforçar.

  // PADRÃO D — Corpo catch colado após {  (ex: catch (x:unknown) { if (y) ...)
  const patternD = /catch\s*\([^)]*\)\s*\{\r?\n?[ \t]*([^\s{])/;
  const lines = content.split(/\r?\n/);
  const relined = [];
  let linhasFix = 0;
  const catchWithBodyRe = /^(\s*catch\s*\([^)]*\)\s*\{)\s*(.*)$/;
  for (const line of lines) {
    const mm = line.match(catchWithBodyRe);
    if (mm && mm[2] && mm[2].trim().length > 0) {
      const header = mm[1];
      let body = mm[2].trimStart();
      const baseIndent = mm[1].match(/^(\s*)/)[1];
      const bodyIndent = baseIndent + '  ';
      relined.push(header);
      relined.push(bodyIndent + body);
      linhasFix++;
      totalFixed++;
    } else {
      relined.push(line);
    }
  }
  if (linhasFix > 0) {
    // Preservar line endings (LF no Node.js, mas juntar com \n simples)
    content = relined.join('\n');
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}

console.log(`fix v14 (TS1472 ULTIMATE all brace-newlines + CRLF):`);
console.log(`  - Arquivos modificados  : ${filesModified}`);
console.log(`  - Total de fixes aplicados: ${totalFixed}`);
