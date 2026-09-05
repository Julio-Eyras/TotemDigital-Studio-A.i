#!/usr/bin/env node
// Script: _fix_imports_v3_multiline.mjs
// Versao 3: Detecta statements IMPORT multi-linha corretamente, inserindo
//           `import { normalizeError }` APOS o ULTIMO import FECHADO com `;`.
// Regra: Um statement import soh esta COMPLETO (fechado) quando o SEMICOLON `;`
//        que o encerra aparece na linha. Para imports multi-linha `import {\n  X,\n} from '';`
//        o `;` soh aparece na ultima linha do bloco, e eh la que contamos como "fim".
// Modo: node scripts/_fix_imports_v3_multiline.mjs

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd());
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend', 'src');
const UTILS_ERRORS_ABS = path.join(BACKEND_SRC, 'utils', 'errors.ts');

function relativeImportFor(fileAbs) {
  const fromDir = path.dirname(fileAbs);
  const rel = path.relative(fromDir, UTILS_ERRORS_ABS);
  let relPosix = rel.split(path.sep).join('/');
  if (!relPosix.startsWith('.')) relPosix = './' + relPosix;
  const relNoExt = relPosix.replace(/\.ts$/, '');
  return `import { normalizeError } from '${relNoExt}';`;
}

/**
 * Analisar bloco de imports robustamente (suporta multi-linha).
 * @param {string[]} origLines
 * @returns {{
 *   hasValidNormalizeImport: boolean,
 *   anyImportFound: boolean,
 *   lastImportStatementEndLine: number,  // indice da ULTIMA linha do ULTIMO import statement (fechado com ;)
 *   normalizeImportLines: number[]       // indices de LINHAS onde aparece normalizeError num import statement
 * }}
 */
function analyzeImportsRobust(origLines) {
  const N = origLines.length;
  let inBlockComment = false;
  let inMultiLineImport = false;
  let currentStmtFirstLine = -1;
  let currentStmtHasNormalize = false;
  const normalizeImportLines = [];
  let anyImportFound = false;
  let lastImportStatementEndLine = -1;
  let hasValidNormalizeImport = false;

  function flushStmt(endLineIdx) {
    // chamar quando statement import (single ou multi) encerrou com `;`
    anyImportFound = true;
    lastImportStatementEndLine = endLineIdx;
    if (currentStmtHasNormalize) {
      normalizeImportLines.push(endLineIdx); // marcar ultima linha do statement com normalize
      hasValidNormalizeImport = true;
    }
  }

  for (let i = 0; i < N; i++) {
    let line = origLines[i];
    let trimmed = line.trim();

    // --- Ignorar comentarios bloco ---
    if (inBlockComment) {
      if (/.*\*\//.test(trimmed)) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      if (/.*\*\//.test(trimmed)) inBlockComment = false;
      continue;
    }
    // --- Ignorar comentario single-line ---
    if (trimmed.startsWith('//')) continue;
    // --- Linha vazia (nao quebra imports multi, mas nao termina nada) ---
    if (trimmed.length === 0) continue;

    // Agora: linha util nao-comentario

    // Detectar se ESTAMOS dentro de um statement import multi-linha
    if (!inMultiLineImport) {
      // Fora de multi-linha: esperar inicio de import statement
      const isImportStart = /^import\s/.test(trimmed);
      if (!isImportStart) {
        // Nao eh import, nao eh comentario, nao eh vazio -> ACABOU o bloco de imports
        break;
      }
      // --- Inicio de statement import ---
      currentStmtFirstLine = i;
      currentStmtHasNormalize = /normalizeError/.test(line);
      // Verificar se statement FECHA na MESMA LINHA (com `;`)
      // Mas atenção: `import { A } from 'x'; ` e single line.
      // `import { A, B` e inicio de multi.
      // Checar se terminou com ; que pertence ao import statement.
      const trimmedHasSemicolonAtEnd = /;[ \t]*$/.test(trimmed);
      // Detectar multi-linha: import que comeca com chave aberta e nao fecha na mesma linha
      const opensBraceUnclosed =
        (trimmed.includes('{') && !trimmed.includes('}')) ||
        (!trimmedHasSemicolonAtEnd && /^import\s/.test(trimmed));

      if (trimmedHasSemicolonAtEnd && !opensBraceUnclosed) {
        // Statement single-line fechado
        flushStmt(i);
        currentStmtFirstLine = -1;
        inMultiLineImport = false;
      } else {
        // Iniciou multi-linha
        inMultiLineImport = true;
      }
    } else {
      // DENTRO de statement multi-linha import
      if (/normalizeError/.test(line)) currentStmtHasNormalize = true;

      // Statement multi acaba quando encontramos `;` no final da linha (e ja fechamos `} from ''`)
      // Para nao ter duvida: multi import acaba sempre na linha cujo trimmed termina com `;`
      // e nessa linha o statement inteiro esta fechado.
      if (/;[ \t]*$/.test(trimmed)) {
        flushStmt(i);
        inMultiLineImport = false;
        currentStmtFirstLine = -1;
      }
      // senao: continua multi-linha na prox
    }
  }

  return {
    hasValidNormalizeImport,
    anyImportFound,
    lastImportStatementEndLine,
    normalizeImportLines,
  };
}

/**
 * Dado o arquivo e os indices do inicio/ fim dos statements,
 * encontra o PRIMEIRO indice de linha NAO comentario/NAO vazia.
 */
function findFirstNonHeaderNonEmptyLine(origLines) {
  const N = origLines.length;
  let inBlockComment = false;
  for (let i = 0; i < N; i++) {
    const trimmed = origLines[i].trim();
    if (inBlockComment) {
      if (/.*\*\//.test(trimmed)) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      if (/.*\*\//.test(trimmed)) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('//')) continue;
    if (trimmed.length === 0) continue;
    return i;
  }
  return 0;
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
let skippedNoUsage = 0;
let skippedAlready = 0;
let insertedAtHeader = 0;
let filesTouched = [];

console.log(`[fix-imports-v3] Iniciando: ${allFiles.length} arquivos .ts`);

for (const absFile of allFiles) {
  const content = fs.readFileSync(absFile, 'utf8');
  if (!/normalizeError\s*\(/.test(content)) {
    skippedNoUsage++;
    continue;
  }
  const lines = content.split(/\r?\n/);
  const analysis = analyzeImportsRobust(lines);
  if (analysis.hasValidNormalizeImport) {
    skippedAlready++;
    continue;
  }

  const newImportLine = relativeImportFor(absFile);
  const linesMut = lines.slice();
  let insertIdx = -1;
  if (analysis.anyImportFound && analysis.lastImportStatementEndLine >= 0) {
    insertIdx = analysis.lastImportStatementEndLine + 1;
  } else {
    insertIdx = findFirstNonHeaderNonEmptyLine(linesMut);
    insertedAtHeader++;
  }
  linesMut.splice(insertIdx, 0, newImportLine);
  inserted++;
  fs.writeFileSync(absFile, linesMut.join('\n'), 'utf8');
  filesTouched.push(path.relative(PROJECT_ROOT, absFile));
}

console.log(`[fix-imports-v3] CONCLUIDO`);
console.log(`  - Arquivos escaneados       : ${allFiles.length}`);
console.log(`  - Pulados (nao usam fn)     : ${skippedNoUsage}`);
console.log(`  - Pulados (ja tem import)   : ${skippedAlready}`);
console.log(`  - Imports INSERIDOS         : ${inserted}`);
console.log(`  - Inseridos em header (sem bloco import) : ${insertedAtHeader}`);
console.log(`  - Arquivos modificados      : ${filesTouched.length}`);
if (filesTouched.length) {
  console.log('  Primeiros 10:');
  for (const p of filesTouched.slice(0, 10)) console.log('   - ' + p);
  if (filesTouched.length > 10)
    console.log(`   ... (+${filesTouched.length - 10})`);
}
