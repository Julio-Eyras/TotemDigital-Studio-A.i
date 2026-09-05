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

  // Padrão 1: `qualquer_coisa_NAO_newline } catch (...) {`
  //   Captura: caractere final válido + } + catch colado
  //   Substitui por: caractere + \n + } catch
  const pattern1 = /([^\n\}])\s*\}\s*catch\s*\(/g;
  let matches = content.match(pattern1);
  if (matches && matches.length > 0) {
    content = content.replace(pattern1, (m, lastChar) => {
      totalFixed++;
      return `${lastChar}\n} catch (`;
    });
  }

  // Padrão 2: `// comentario } catch` onde `}` fica no FINAL da linha de comentário sem newline
  //   Já é coberto pelo Padrão 1 acima (o último caractere do comentário é o lastChar).

  // Padrão 3: `} catch (...) {ALGUMA_COISA` (sem newline após o { do catch)
  //   Linha-por-linha para separar o corpo catch do {
  const pattern3 = /catch\s*\([^)]*\)\s*\{(\s*[^\s{])/g;
  matches = content.match(pattern3);
  if (matches && matches.length > 0) {
    const lines = content.split('\n');
    const relined = [];
    const catchHdrWithBody = /catch\s*\([^)]*\)\s*\{(\s*)([^{\n].*)$/;
    for (const line of lines) {
      const m = line.match(catchHdrWithBody);
      if (m) {
        const idx = line.indexOf('{') + 1;
        const before = line.slice(0, idx);
        let bodyStr = line.slice(idx).trimStart();
        if (bodyStr.length > 0) {
          // Acha indentação do before + 2
          const indentBase = before.match(/^(\s*)/)[1];
          const bodyIndent = indentBase + '  ';
          relined.push(before);
          relined.push(bodyIndent + bodyStr);
          totalFixed++;
          continue;
        }
      }
      relined.push(line);
    }
    content = relined.join('\n');
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}

console.log(`fix v13 (TS1472 definitive all-catch-brace newline):`);
console.log(`  - Arquivos modificados              : ${filesModified}`);
console.log(`  - Total de separacoes } catch / {corpo : ${totalFixed}`);
