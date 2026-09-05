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
let totalPattern1Fixed = 0;
let totalPattern2Fixed = 0;
let totalPattern3Fixed = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

  // Padrão 1: const e = normalizeError(X);} catch (Y: unknown) {
  //   => const e está FORA do catch, antes da chave de fechamento do try.
  //   Substituir por: } catch (X: unknown) { \n const e = normalizeError(X);
  let matches;
  const pattern1 = /const\s+e\s*=\s*normalizeError\(\s*(\w+)\s*\)\s*;\s*\}\s*catch\s*\(\s*\w+\s*:\s*unknown\s*\)\s*\{/g;
  matches = content.match(pattern1);
  if (matches && matches.length > 0) {
    totalPattern1Fixed += matches.length;
    content = content.replace(pattern1, (match, paramName) => {
      return `} catch (${paramName}: unknown) {\n      const e = normalizeError(${paramName});`;
    });
  }

  // Padrão 2: } catch (X: unknown) {ALGUMA_COISA (sem newline após {)
  //   Separar: } catch (X: unknown) { \n ALGUMA_COISA
  const pattern2 = /catch\s*\(\s*\w+\s*:\s*unknown\s*\)\s*\{(\s*)([^{\n].*?)(\n|$)/g;
  matches = content.match(pattern2);
  if (matches && matches.length > 0) {
    const lines = content.split('\n');
    const relined = [];
    const catchHeader = /catch\s*\(\s*\w+\s*:\s*unknown\s*\)\s*\{(\s*)/;
    for (let line of lines) {
      const hd = line.match(catchHeader);
      if (hd) {
        const idx = line.indexOf('{') + 1;
        const beforeBrace = line.slice(0, idx);
        const afterBrace = line.slice(idx).trimStart();
        if (afterBrace.length > 0 && !afterBrace.startsWith('\n')) {
          const indent = beforeBrace.match(/^(\s*)/)[1] + '  ';
          relined.push(beforeBrace);
          relined.push(indent + afterBrace);
          totalPattern2Fixed++;
          continue;
        }
      }
      relined.push(line);
    }
    content = relined.join('\n');
  }

  // Padrão 3: catch (e: unknown) { ... const e = normalizeError(e);
  //   Conflito de nome: parâmetro é `e` e declara const e com mesmo nome.
  //   Solução: renomear parâmetro do catch de `e` para `rawErr`
  const catchERegex = /catch\s*\(\s*e\s*:\s*unknown\s*\)\s*\{/g;
  matches = content.match(catchERegex);
  if (matches && matches.length > 0) {
    // Primeiro, renomear os parâmetros catch (e:) para catch (rawErr:)
    content = content.replace(catchERegex, 'catch (rawErr: unknown) {');
    // Depois, mudar const e = normalizeError(e); para const e = normalizeError(rawErr); SOMENTE quando o argumento for `e` cru.
    content = content.replace(/const\s+e\s*=\s*normalizeError\(\s*e\s*\)\s*;/g, 'const e = normalizeError(rawErr);');
    totalPattern3Fixed += matches.length;
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}

console.log(`fix v12 (v7 massive inline catch mess recovery):`);
console.log(`  - Arquivos modificados               : ${filesModified}`);
console.log(`  - Padrão 1 (const e FORA + }catch colado) fixados: ${totalPattern1Fixed}`);
console.log(`  - Padrão 2 (corpo catch colado após {) separados : ${totalPattern2Fixed}`);
console.log(`  - Padrão 3 (param e conflito) renomeados         : ${totalPattern3Fixed}`);
