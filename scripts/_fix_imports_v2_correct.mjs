#!/usr/bin/env node
// Script: _fix_imports_v2_correct.mjs
// Objetivo: Re-inserir import { normalizeError } de utils/errors em arquivos backend que
//           usam a funcao mas perderam o import apos regressao do _fix_super_simple.mjs.
// Algoritmo MELHORADO: ignora comentarios /** */ multi-linha, //, whitespace no TOPO
//                      antes de detectar primeiro/ultimo import real.
// Modo: node scripts/_fix_imports_v2_correct.mjs

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd());
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend', 'src');
const UTILS_ERRORS_ABS = path.join(BACKEND_SRC, 'utils', 'errors.ts');

// ------------- helpers caminho relativo -------------
function relativeImportFor(fileAbs) {
  const fromDir = path.dirname(fileAbs);
  const rel = path.relative(fromDir, UTILS_ERRORS_ABS);
  let relPosix = rel.split(path.sep).join('/');
  if (!relPosix.startsWith('.')) relPosix = './' + relPosix;
  const relNoExt = relPosix.replace(/\.ts$/, '');
  return `import { normalizeError } from '${relNoExt}';`;
}

// ------------- parser topo arquivo MELHORADO -------------
/**
 * Remove comentarios /** * / multi-linha e // single-line + whitespace do inicio,
 * retorna { lines: linhas processadas (sem o bloco header comment removido,
 *          mas com flag por linha se e import real),
 *          firstImportIdx: indice na LINHA ORIGINAL do primeiro import,
 *          lastImportIdx:  indice na LINHA ORIGINAL do ultimo import,
 *          hasValidNormalizeImport: boolean }
 * ATENCAO: Preserva LINHAS ORIGINAIS inteiras, so marca quais sao imports reais.
 */
function analyzeHeader(origLines) {
  const N = origLines.length;
  let inBlockComment = false;
  const isRealImport = new Array(N).fill(false);
  let anyImportFound = false;
  let firstImportIdx = -1;
  let lastImportIdx = -1;
  let hasValidNormalizeImport = false;
  let normalizeImportLineCount = 0;

  for (let i = 0; i < N; i++) {
    let line = origLines[i];
    let trimmed = line.trim();

    // handle comentario bloco multi-linha (/** ... */  ou /* ... */)
    // Nao marcamos nada como import enquanto dentro de bloco de comentario
    if (inBlockComment) {
      if (/.*\*\//.test(trimmed)) {
        inBlockComment = false;
      }
      continue; // nao import, linha dentro de comentario bloco
    }

    // entrada em comentario bloco na linha atual
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      if (/.*\*\//.test(trimmed)) {
        inBlockComment = false; // bloco fechou na mesma linha
      }
      continue;
    }

    // comentario single-line
    if (trimmed.startsWith('//')) continue;

    // linha vazia / so whitespace
    if (trimmed.length === 0) continue;

    // agora: linha NAO e comentario nem vazia
    // Detectar import real (qualquer variacao)
    const importMatch = trimmed.match(/^import\s+/);
    if (importMatch) {
      // eh um statement import (mesmo que multi-linha terminado na proxima linha,
      // para nosso proposito basta contar ate ultimo `;` de um import)
      isRealImport[i] = true;
      anyImportFound = true;
      if (firstImportIdx === -1) firstImportIdx = i;
      lastImportIdx = i;

      // check normalize
      if (/normalizeError/.test(trimmed)) {
        normalizeImportLineCount++;
        if (
          /import\s*\{[^}]*normalizeError[^}]*\}\s*from\s*['"].*utils\/errors['"]/.test(
            trimmed
          ) ||
          /import\s*\{[^}]*normalizeError[^}]*\}\s*from\s*['"].*\/errors['"]/.test(
            trimmed
          )
        ) {
          hasValidNormalizeImport = true;
        }
      }
    } else {
      // Nao eh comentario, nao eh vazia, nao eh import -> saiu do bloco de imports.
      // Para garantir, ainda checamos imports no final mas break.
      if (anyImportFound) break;
    }
  }

  return {
    isRealImport,
    firstImportIdx,
    lastImportIdx,
    hasValidNormalizeImport,
    normalizeImportLineCount,
    anyImportFound,
  };
}

// ------------- walk -------------
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
let inserted = 0;
let removedDup = 0;
let skippedNoUsage = 0;
let skippedAlready = 0;
let skippedNoImportsBlock = 0;
let filesTouchedNames = [];

console.log(`[fix-imports-v2] Iniciando: ${allFiles.length} arquivos .ts em backend/src`);

for (const absFile of allFiles) {
  const content = fs.readFileSync(absFile, 'utf8');

  // 1) Checar se arquivo USA normalizeError( no corpo
  if (!/normalizeError\s*\(/.test(content)) {
    skippedNoUsage++;
    continue;
  }

  const lines = content.split(/\r?\n/);
  const analysis = analyzeHeader(lines);

  // 2) Se ja tem import valido e sem duplicatas, pular
  if (analysis.hasValidNormalizeImport && analysis.normalizeImportLineCount <= 1) {
    skippedAlready++;
    continue;
  }

  const wantImportLine = relativeImportFor(absFile);
  const linesAsList = lines.slice();
  let changed = false;

  // 3) Remover imports DUPLICADOS ou INVALIDOS de normalizeError (count > 1)
  //    ou imports que mencionam normalizeError mas nao sao o correto
  if (analysis.normalizeImportLineCount >= 1) {
    // iterar de tras pra frente para nao baguncar indices
    for (let i = linesAsList.length - 1; i >= 0; i--) {
      const ln = linesAsList[i];
      if (/^import\s*\{[^}]*normalizeError[^}]*\}\s*from/.test(ln.trim())) {
        // remover import velho
        linesAsList.splice(i, 1);
        removedDup++;
        changed = true;
      }
    }
  }

  // Re-analisar apos remocao (se houve) para achar lastImportIdx correto
  const lines2 = changed ? linesAsList : linesAsList;
  const analysis2 = analyzeHeader(lines2);

  // 4) Inserir o NOVO import na posicao correta
  if (analysis2.anyImportFound && analysis2.lastImportIdx >= 0) {
    lines2.splice(analysis2.lastImportIdx + 1, 0, wantImportLine);
    inserted++;
    changed = true;
  } else {
    // Nenhum import no arquivo (rarissimo, mas pode ocorrer): inserir depois de header
    // Procurar primeira linha NAO comentario/vazia e inserir acima dela
    let idx = 0;
    const Nl = lines2.length;
    let inBlock = false;
    for (; idx < Nl; idx++) {
      const t = lines2[idx].trim();
      if (inBlock) {
        if (/\*\//.test(t)) inBlock = false;
        continue;
      }
      if (t.startsWith('/*')) {
        inBlock = true;
        if (/\*\//.test(t)) inBlock = false;
        continue;
      }
      if (t.startsWith('//') || t.length === 0) continue;
      break;
    }
    if (idx < Nl) {
      lines2.splice(idx, 0, wantImportLine);
      inserted++;
      changed = true;
    } else {
      // arquivo totalmente vazio? anexar
      lines2.push(wantImportLine);
      inserted++;
      changed = true;
    }
    skippedNoImportsBlock++;
  }

  if (changed) {
    const newContent = lines2.join('\n');
    fs.writeFileSync(absFile, newContent, 'utf8');
    filesTouchedNames.push(path.relative(PROJECT_ROOT, absFile));
  }
}

console.log(`[fix-imports-v2] CONCLUIDO`);
console.log(`  - Arquivos escaneados       : ${allFiles.length}`);
console.log(`  - Pulado (sem uso da fn)    : ${skippedNoUsage}`);
console.log(`  - Pulado (ja tinha import)  : ${skippedAlready}`);
console.log(`  - Imports INSERIDOS         : ${inserted}`);
console.log(`  - Imports DUPLICADOS removs : ${removedDup}`);
console.log(`  - Casos sem bloco de import : ${skippedNoImportsBlock}`);
console.log(`  - Arquivos modificados      : ${filesTouchedNames.length}`);
if (filesTouchedNames.length > 0) {
  console.log('\n  Primeiros 15 arquivos modificados:');
  for (const p of filesTouchedNames.slice(0, 15)) console.log('   - ' + p);
  if (filesTouchedNames.length > 15)
    console.log(`   ... (+${filesTouchedNames.length - 15} arquivos)`);
}
