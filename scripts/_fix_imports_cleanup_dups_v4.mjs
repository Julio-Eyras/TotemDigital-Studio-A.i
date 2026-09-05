#!/usr/bin/env node
// Script: _fix_imports_cleanup_dups_v4.mjs
// Correcoes especificas pos-v3:
//   1. Remover DUPLICATAS de `import { normalizeError }` no mesmo arquivo
//   2. Remover import de normalizeError DENTRO do proprio utils/errors.ts (auto-import impossivel)
//   3. Remover imports de normalizeError marcados TS6133 (arquivo nao chama a funcao)
//   4. Corrigir caminhos relativos ERRADOS:
//        - `../utils/errors` em arquivos da raiz backend/src/ (devem ser `./utils/errors`)
//        - caminhos errados em subdiretorios tipo services/aiVideo/ (3 niveis)
// Modo: node scripts/_fix_imports_cleanup_dups_v4.mjs

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd());
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend', 'src');
const UTILS_ERRORS_ABS = path.join(BACKEND_SRC, 'utils', 'errors.ts');

function correctRelativeFor(fileAbs) {
  const fromDir = path.dirname(fileAbs);
  const rel = path.relative(fromDir, UTILS_ERRORS_ABS);
  let relPosix = rel.split(path.sep).join('/');
  if (!relPosix.startsWith('.')) relPosix = './' + relPosix;
  const relNoExt = relPosix.replace(/\.ts$/, '');
  return relNoExt;
}

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
let removedDups = 0;
let removedUnused = 0;
let fixedPaths = 0;
let removedSelfImport = 0;
let filesTouched = 0;

for (const absFile of allFiles) {
  const content = fs.readFileSync(absFile, 'utf8');
  const lines = content.split(/\r?\n/);

  // CASO ESPECIAL: utils/errors.ts — NUNCA deve importar a si mesmo
  const isErrorsTs = path.relative(absFile, UTILS_ERRORS_ABS) === '';

  const correctRelPath = correctRelativeFor(absFile);
  const normalizeImportRe =
    /^[ \t]*import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]([^'"]*errors[^'"]*)['"][ \t]*;?[ \t]*$/;

  // Contar ocorrencias de imports normalizeError
  // indice -> linha / match
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(normalizeImportRe);
    if (m) {
      const names = m[1];
      const from = m[2];
      if (/\bnormalizeError\b/.test(names)) {
        found.push({ idx: i, names, from, fullLine: lines[i] });
      }
    }
  }
  if (found.length === 0 && !isErrorsTs) continue;

  let changed = false;
  const newLines = lines.slice();

  // 1) utils/errors.ts: remover TODO import de si mesmo (qualquer qtd)
  if (isErrorsTs) {
    for (let k = found.length - 1; k >= 0; k--) {
      newLines.splice(found[k].idx, 1);
      removedSelfImport++;
      changed = true;
    }
  } else if (found.length > 0) {
    const usedInBody = /normalizeError\s*\(/.test(content);

    // 2) Remover unused (TS6133): arquivo nao chama normalizeError()
    if (!usedInBody) {
      for (let k = found.length - 1; k >= 0; k--) {
        newLines.splice(found[k].idx, 1);
        removedUnused++;
        changed = true;
      }
    } else {
      // 3) DUPLICATAS: manter apenas 1, e corrigir o caminho
      // remover todos duplicados do final para tras (exceto o 1o)
      for (let k = found.length - 1; k >= 1; k--) {
        newLines.splice(found[k].idx, 1);
        removedDups++;
        changed = true;
      }
      // Corrigir caminho do PRIMEIRO (que sobreviveu) se errado
      const firstLineIdx = found[0].idx;
      // Ajustar: se apos remocoes os indices mudaram? Para o primeiro idx NÃO muda se
      // removemos os de tras pra frente, mas para garantir: re-procurar no newLines
      let newFirstIdx = -1;
      for (let i = 0; i < newLines.length; i++) {
        if (newLines[i].match(normalizeImportRe)) {
          const nm = newLines[i].match(normalizeImportRe);
          if (nm && /\bnormalizeError\b/.test(nm[1])) {
            newFirstIdx = i;
            break;
          }
        }
      }
      if (newFirstIdx >= 0) {
        // Recriar a linha com caminho correto
        const existing = newLines[newFirstIdx];
        const nm = existing.match(normalizeImportRe);
        if (nm) {
          // Extrair names, preservar outros como { normalizeError, detectX } etc
          const namesRaw = nm[1];
          const fromRaw = nm[2];
          const wantFrom = correctRelPath;
          if (fromRaw !== wantFrom) {
            // Preservar names: mas o script v3 inseriu apenas normalizeError separado.
            // Se o import original tinha multiplos nomes, manter.
            // Se o namesRaw soh tem normalizeError, substituimos tranquilamente.
            if (namesRaw.trim() === 'normalizeError') {
              newLines[newFirstIdx] = `import { normalizeError } from '${wantFrom}';`;
              fixedPaths++;
              changed = true;
            } else {
              // Multiplos names: ajustar apenas o from (cuidado, pois pode ser outro arquivo)
              // Se o from NAO contem errors no nome, nao ajustar.
              if (/errors/.test(fromRaw)) {
                newLines[newFirstIdx] = `import { ${namesRaw} } from '${wantFrom}';`;
                fixedPaths++;
                changed = true;
              }
            }
          }
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(absFile, newLines.join('\n'), 'utf8');
    filesTouched++;
  }
}

console.log(`[cleanup-v4-imports] CONCLUIDO`);
console.log(`  - Arquivos modificados       : ${filesTouched}`);
console.log(`  - Imports duplicados removs  : ${removedDups}`);
console.log(`  - Imports unused (TS6133) rm : ${removedUnused}`);
console.log(`  - Self-import errors.ts rm   : ${removedSelfImport}`);
console.log(`  - Caminhos relativos fixados : ${fixedPaths}`);
