#!/usr/bin/env node
// Script: _fix_all_catch_inline_v7.mjs
// Corrige TS1472 de forma sistematica: encontra TODO padrao onde `} catch (...)`
// esteja colado na mesma linha que qualquer statement/comentario, e separa em newline
// com indentacao correta baseada no `try` pai ou na linha anterior.
// Tambem corrige: `statement ;} catch`, `statement // comentario } catch`, etc
// Modo: node scripts/_fix_all_catch_inline_v7.mjs

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
let arquivosModificados = 0;
let totalFixes = 0;

for (const absFile of allFiles) {
  let src = fs.readFileSync(absFile, 'utf8');
  const orig = src;
  // Primeiro normalizo newlines para \n
  src = src.replace(/\r\n/g, '\n');

  // Padrao 1: na MESMA LINHA, temos fechamento de chave } de try seguido de catch
  // Pode ser:   X;} catch ...      ou   X // comment} catch ...   ou   X} catch ...
  // Regex: encontra } catch (error: unknown) {  ou  } catch (err) {   etc colado no final da linha
  let changed = true;
  let rodadas = 0;
  // Aplicar multiplas vezes pois regex pode nao pegar sobreposicoes
  while (changed && rodadas < 5) {
    changed = false;
    rodadas++;
    // Match 1: [nao \n] + } catch([^)]*):unknown [...] {
    const re1 = /([^\n\}])\s*\}[\ \t]*catch[\ \t]*\(([^)]*)\)[\ \t]*\{/g;
    let novo = src.replace(re1, (_m, before, args) => {
      // Determinar indentacao: pegar o final da linha anterior (dentro do bloco try)
      // para isso, encontrar o comeco da linha
      const beforeStr = String(before);
      const linesBefore = beforeStr.split('\n');
      const lastLineBefore = linesBefore[linesBefore.length - 1];
      const identMatch = lastLineBefore.match(/^([\ \t]*)/);
      const baseIdent = identMatch ? identMatch[1] : '';
      totalFixes++;
      changed = true;
      return `${beforeStr}\n${baseIdent}} catch (${args}) {`;
    });
    if (novo !== src) src = novo;

    // Match 2: Padrão } catch colado APOS um newline (raro) mas } no inicio da linha
    // com um caracter colado antes, ou    } catch (...){ sem newline antes de algum statement.
    // (ja coberto acima quase sempre)

    // Match 3: `} catch` COM espaco mas na mesma linha do comentario return etc onde
    // o regex 1 talvez nao pegue por causa de chave  }  como primeiro caracter
    // Ex:   return res.status(200).json(x);} catch ...    (ja pego no re1)
  }

  // Aplicar \r\n de volta se arquivo original usava
  const usouCrlf = orig.indexOf('\r\n') !== -1;
  if (usouCrlf) src = src.replace(/\n/g, '\r\n');

  if (src !== orig) {
    fs.writeFileSync(absFile, src, 'utf8');
    arquivosModificados++;
  }
}
console.log(`[_fix_all_catch_inline_v7] CONCLUIDO`);
console.log(`  - Arquivos modificados : ${arquivosModificados}`);
console.log(`  - Separacoes } catch efetuadas : ${totalFixes}`);
