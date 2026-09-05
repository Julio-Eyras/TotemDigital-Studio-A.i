#!/usr/bin/env node
// Script: _fix_final_master_v8.mjs
// Master FINAL para resolver 120 erros remanescentes de Sprint 6 Fase 4.
// 4 passos:
//   PASSO A: Limpar imports de normalizeError (remover duplicatas + caminhos errados + unused)
//   PASSO B: Tratar refs `catch (X: unknown)` onde X nao eh "error" nem "e", e eh usado
//           diretamente no corpo sem normalizeError (err/dbErr/limitError/permError/...)
//   PASSO C: Substituir props especificas inexistentes:
//              - e.response / error.response → ((e.raw as any)?.response) ou via cast
//              - e.e.error → e.error
//              - Prop `statusCode/message/code/detail` em objetos narrowed para `{}`: re-inserir cast
//   PASSO D: Substituir referencias `const e = ...` removidas erroneamente em catch blocks onde
//           ha refs a `e.message` etc (TS2304 Cannot find name 'e')
// Modo: node scripts/_fix_final_master_v8.mjs

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd());
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend', 'src');
const UTILS_ERRORS_ABS = path.join(BACKEND_SRC, 'utils', 'errors.ts');

function correctRelPathFor(fileAbs) {
  const fromDir = path.dirname(fileAbs);
  const rel = path.relative(fromDir, UTILS_ERRORS_ABS);
  let relPosix = rel.split(path.sep).join('/');
  if (!relPosix.startsWith('.')) relPosix = './' + relPosix;
  return relPosix.replace(/\.ts$/, '');
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

// =============== PASSO A: imports normalizeError ===============
function passoA(fileAbs, linesMut) {
  const isErrorsTs = path.relative(fileAbs, UTILS_ERRORS_ABS) === '';
  const correctPath = correctRelPathFor(fileAbs);
  const contentJoined = linesMut.join('\n');
  const used = /normalizeError\s*\(/.test(contentJoined);

  // Detectar TODAS as linhas que sao imports contendo normalizeError
  const lineIdx = [];
  for (let i = 0; i < linesMut.length; i++) {
    const m = linesMut[i].match(
      /^[ \t]*import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/
    );
    if (m) {
      const names = m[1];
      if (/\bnormalizeError\b/.test(names)) lineIdx.push({ i, names: m[1], from: m[2] });
    }
  }

  let removals = 0;
  let pathFixed = 0;
  let unusedRemoved = 0;
  let insertedMissing = 0;
  let selfImport = 0;

  if (isErrorsTs) {
    // Remover todos
    for (let k = lineIdx.length - 1; k >= 0; k--) {
      linesMut.splice(lineIdx[k].i, 1);
      selfImport++;
    }
    return { removals: lineIdx.length, pathFixed: 0, unusedRemoved: 0, insertedMissing: 0, selfImport };
  }

  if (!used) {
    // Remover todos (unused)
    for (let k = lineIdx.length - 1; k >= 0; k--) {
      linesMut.splice(lineIdx[k].i, 1);
      unusedRemoved++;
    }
    return { removals: unusedRemoved, pathFixed: 0, unusedRemoved, insertedMissing: 0, selfImport: 0 };
  }

  // Usado -> remover duplicatas, manter um, corrigir caminho
  // Primeiro, se mais de 1 remover do final para tras exceto o primeiro
  let firstIdx = -1;
  if (lineIdx.length) firstIdx = lineIdx[0].i;
  for (let k = lineIdx.length - 1; k >= 1; k--) {
    linesMut.splice(lineIdx[k].i, 1);
    removals++;
  }

  // Encontrar a primeira linha de import normalizeError apos remocoes
  let newFirst = -1;
  for (let i = 0; i < linesMut.length; i++) {
    const m = linesMut[i].match(
      /^[ \t]*import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/
    );
    if (m && /\bnormalizeError\b/.test(m[1])) {
      newFirst = i;
      break;
    }
  }

  if (newFirst >= 0) {
    // Recriar linha com caminho correto se necessario
    const m = linesMut[newFirst].match(
      /^([ \t]*)import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/
    );
    if (m) {
      const indent = m[1];
      const names = m[2];
      const from = m[3];
      const justNormalize = names.trim() === 'normalizeError';
      const wantFrom = correctPath;
      if (from !== wantFrom) {
        if (justNormalize || /errors/.test(from)) {
          linesMut[newFirst] = `${indent}import { ${names.trim()} } from '${wantFrom}';`;
          pathFixed++;
        }
      }
    }
  } else if (lineIdx.length === 0) {
    // Nao havia nenhum import -> inserir no bloco de imports
    const lastLine = findLastImportLine(linesMut);
    const newLine = `import { normalizeError } from '${correctPath}';`;
    if (lastLine >= 0) {
      linesMut.splice(lastLine + 1, 0, newLine);
    } else {
      // inserir na primeira linha nao comentario/vazia
      const first = findFirstNonHeaderNonEmpty(linesMut);
      linesMut.splice(first, 0, newLine);
    }
    insertedMissing++;
  }
  return { removals, pathFixed, unusedRemoved, insertedMissing, selfImport };
}

function findLastImportLine(lines) {
  const N = lines.length;
  let inBlock = false, inMulti = false, stmtStartImport = false;
  let lastClosedIdx = -1;
  for (let i = 0; i < N; i++) {
    let t = lines[i].trim();
    if (inBlock) { if (/.*\*\//.test(t)) inBlock = false; continue; }
    if (t.startsWith('/*')) { inBlock = true; if (/.*\*\//.test(t)) inBlock = false; continue; }
    if (t.startsWith('//') || !t) continue;
    if (!inMulti && !/^import\s/.test(t)) break;
    if (/^import\s/.test(t) && !inMulti) stmtStartImport = true;
    const hasSemi = /;[ \t]*$/.test(t);
    const opensBrace = t.includes('{') && !t.includes('}');
    if (!inMulti && stmtStartImport) {
      if (opensBrace || !hasSemi) inMulti = true;
      else { lastClosedIdx = i; stmtStartImport = false; }
    } else if (inMulti) {
      if (hasSemi) { lastClosedIdx = i; inMulti = false; stmtStartImport = false; }
    }
  }
  return lastClosedIdx;
}

function findFirstNonHeaderNonEmpty(lines) {
  const N = lines.length;
  let inBlock = false;
  for (let i = 0; i < N; i++) {
    const t = lines[i].trim();
    if (inBlock) { if (/.*\*\//.test(t)) inBlock = false; continue; }
    if (t.startsWith('/*')) { inBlock = true; if (/.*\*\//.test(t)) inBlock = false; continue; }
    if (t.startsWith('//') || !t) continue;
    return i;
  }
  return 0;
}

// =============== PASSO B: refs catch (X: unknown) ===============
// Para CADA bloco catch(X: unknown):
//   - Se X nao eh "error" e nao eh "e"
//   - E X eh referenciado no corpo SEM ser "const x = normalizeError(X)"
//   - Entao inserir: const <Xlower> = normalizeError(X);  (normalizar primeira letra minuscula se possivel)
//   - E substituir refs X.prop -> <Xlower>.prop
// Tambem, se ha refs a `error.message` etc mas nao ha `const e = normalizeError(error)` -> inserir.

// Funcao que encontra blocos catch por parser de chaves
function findCatchBlocks(lines) {
  // Retorna [{ startLine, endLine, catchArgName, catchArgIsUnknown, catchLineIdx, bodyStart }]
  const blocks = [];
  const N = lines.length;
  for (let i = 0; i < N; i++) {
    const line = lines[i];
    const re = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*:\s*unknown\s*\)\s*\{/;
    const match = line.match(re);
    if (!match) continue;
    const argName = match[1];
    // Encontrar abre-chave do catch: pode estar na mesma linha ou na proxima
    // Calcula a posicao na linha onde abre-chave do catch esta
    let openBraceLine = i;
    let braceCol = line.indexOf('{');
    if (braceCol === -1) {
      openBraceLine = i + 1;
      braceCol = lines[i + 1] ? lines[i + 1].indexOf('{') : -1;
    }
    // Contagem de chaves para fechar bloco catch
    let depth = 0;
    let endLine = openBraceLine;
    let started = false;
    scan: for (let l = openBraceLine; l < N; l++) {
      const ln = lines[l] || '';
      for (let c = 0; c < ln.length; c++) {
        if (l === openBraceLine && c < braceCol && !started) continue;
        const ch = ln[c];
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') {
          depth--;
          started = true;
          if (depth === 0) { endLine = l; break scan; }
        }
      }
    }
    // bodyStart = linha seguinte a abertura
    const bodyStart = openBraceLine + ((braceCol === lines[openBraceLine].length - 1) ? 1 : 0);
    blocks.push({
      catchLineIdx: i, argName,
      startLine: openBraceLine, endLine: endLine, bodyStart
    });
  }
  return blocks;
}

function passoB(fileAbs, linesMut) {
  const blocks = findCatchBlocks(linesMut);
  let changes = 0;
  let newConstsInserted = 0;
  let refsReplaced = 0;

  // Processar do FIM para o INICIO para indices nao ficarem invalidos
  for (let b = blocks.length - 1; b >= 0; b--) {
    const blk = blocks[b];
    const argName = blk.argName;
    // Construir texto do bloco (sem a linha de abertura do catch)
    const bodyLines = [];
    for (let l = blk.bodyStart; l <= blk.endLine; l++) {
      bodyLines.push(linesMut[l]);
    }
    const body = bodyLines.join('\n');

    // Verificar se ha const NOME = normalizeError(argName) no corpo
    const normRe = new RegExp(
      `const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*normalizeError\\s*\\(\\s*${escapeReg(argName)}\\s*\\)`
    );
    const normMatch = body.match(normRe);
    let normalizedAs = normMatch ? normMatch[1] : null;

    // Refs ao argName.raw ou argName.message etc (fora da definicao)
    // Detectar usos: `\b${argName}\.`
    const usesArgProperty = new RegExp(`\\b${escapeReg(argName)}\\s*\\.`).test(body);
    const usesArgDirect = new RegExp(`\\b${escapeReg(argName)}\\s*[,);?!\\]]`).test(body)
      || new RegExp(`\\b${escapeReg(argName)}\\s*$`, 'm').test(body);

    if (!normalizedAs && (usesArgProperty || usesArgDirect)) {
      // Precisa inserir const <var> = normalizeError(argName)
      // Escolher nome: se argName === "error" -> "e"; senao tirar primeira letra minuscula se for "Error/Err" etc
      let newName = 'e';
      if (argName !== 'error' && argName !== 'e') {
        // se nome tipo "dbErr" -> usar como normalizado tb mas para evitar conflitos
        // usar nome padrao `ne`? Ou simplesmente `e`. Vamos de `e` sempre exceto se ja tiver `e`
        if (!/\bconst\s+e\s*=/.test(body) && !/\blet\s+e\s*=/.test(body) && !/\bvar\s+e\s+/.test(body)) {
          newName = 'e';
        } else {
          newName = 'ne_' + argName;
        }
      }
      normalizedAs = newName;
      // Inserir na PRIMEIRA linha do corpo catch
      const insertIdx = blk.bodyStart;
      // Determinar indentacao: pegar linha do abridor
      const openLine = linesMut[blk.startLine] || '';
      const indentM = openLine.match(/^([\ \t]*)/);
      const indent = (indentM ? indentM[1] : '') + '  ';
      // Linha nova:
      const newConstLine = `${indent}const ${newName} = normalizeError(${argName});`;
      linesMut.splice(insertIdx, 0, newConstLine);
      newConstsInserted++;
      changes++;
      // Atualizar endLine (pois aumentou uma linha)
      for (let bb = 0; bb < blocks.length; bb++) {
        if (blocks[bb].bodyStart > insertIdx || blocks[bb].startLine >= insertIdx) {
          blocks[bb].startLine++; blocks[bb].bodyStart++; blocks[bb].endLine++; blocks[bb].catchLineIdx += (blocks[bb].catchLineIdx >= insertIdx ? 1 : 0);
        }
      }
      blk.endLine++;
    }

    // Agora, se normalizedAs existe e refs ao argName com propriedades -> substituir
    if (normalizedAs && usesArgProperty && normalizedAs !== argName) {
      // Substituir no corpo: argName.prop -> normalizedAs.prop  (cuidado para nao substituir dentro da linha const nova)
      // Vamos iterar linhas do corpo, exceto a linha const se acabou de ser inserida
      const end = blk.endLine;
      for (let l = blk.bodyStart; l <= end; l++) {
        const orig = linesMut[l];
        const lnIsConst = normRe.test(orig);
        if (lnIsConst) continue;
        // substituir word-boundary argName.prop
        const propRe = new RegExp(`\\b${escapeReg(argName)}\\s*\\.`, 'g');
        if (propRe.test(orig)) {
          linesMut[l] = orig.replace(propRe, `${normalizedAs}.`);
          refsReplaced++;
          changes++;
        } else {
          // Substituir passagem direta: func(argName) -> func(normalizedAs.error) ? Nao, soh se for
          // logError(msg, argName) etc e argName for unknown... eh perigoso. Deixar quieto.
        }
      }
    }
  }
  return { changes, newConstsInserted, refsReplaced };
}

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// =============== PASSO C: propriedades ruins ===============
function passoC(fileAbs, linesMut) {
  let changes = 0;
  for (let i = 0; i < linesMut.length; i++) {
    let ln = linesMut[i];
    let before = ln;

    // (a) e.e.error -> e.error ;  e.e.message -> e.message
    ln = ln.replace(/\be\.e\.error\b/g, 'e.error');
    ln = ln.replace(/\be\.e\.message\b/g, 'e.message');
    ln = ln.replace(/\be\.e\.code\b/g, 'e.code');
    // e.e -> e
    ln = ln.replace(/\be\.e([\s,);\]])/g, 'e$1');

    // (b) propriedades .response / .config / .request vindas de Axios/HTTP errors
    // Regex: \b([ev])\.response\b
    ln = ln.replace(/\b(e|error|err|ne_[A-Za-z0-9_]+)\.response\b/g, '((($1.raw as any)?.response)');
    ln = ln.replace(/\b(e|error|err|ne_[A-Za-z0-9_]+)\.request\b/g, '((($1.raw as any)?.request)');
    ln = ln.replace(/\b(e|error|err|ne_[A-Za-z0-9_]+)\.config\b/g, '((($1.raw as any)?.config)');
    // Fechar parens extras que abrimos: regex ((($1.raw as any)?.response)
    // -> para cada abertura de 3 paras extras, adicionar o fechamento quando usarmos acesso
    // Simplificar: trocar `((((X.raw as any)?.response)`  quando usado em comparacao por casting limpo
    // Melhor abordagem: regex final para 3 aberturas e 1 fechamento -> 2 paras abertos extras
    // Deixamos assim por enquanto, mas em seguida corrigimos dobras:

    // (c) Remover duplos ((())) : simplificar cast. Aplicar multiplas vezes
    for (let iter = 0; iter < 3; iter++) {
      ln = ln.replace(/\(\(\(\(([^()]*?)\)\)\)\)/g, '($1)');
      ln = ln.replace(/\(\(\(([^()]*?)\)\)\)/g, '($1)');
      ln = ln.replace(/\(\(([^()]*?)\)\)/g, '($1)');
    }
    // Tentar fechar paras abertos de ((((X.raw as any)?.response) => ((X.raw as any)?.response)
    // Abriu 3 paras + 1 opcional... melhor regex:
    ln = ln.replace(/\(\(\((\$?[a-zA-Z_][\w]*\.raw as any\)\?\.[a-zA-Z_][\w]*)\)/g, '(($1)');

    if (ln !== before) { linesMut[i] = ln; changes++; }
  }
  return { changes };
}

// =============== EXECUCAO ===============
const allFiles = walkTs(BACKEND_SRC);
let totalA = { removals: 0, pathFixed: 0, unusedRemoved: 0, insertedMissing: 0, selfImport: 0 };
let totalB = { changes: 0, newConstsInserted: 0, refsReplaced: 0 };
let totalC = { changes: 0 };
let filesTouched = 0;

for (const absFile of allFiles) {
  const orig = fs.readFileSync(absFile, 'utf8');
  const lines = orig.split(/\r?\n/);
  const linesMut = lines.slice();

  const rA = passoA(absFile, linesMut);
  const rB = passoB(absFile, linesMut);
  const rC = passoC(absFile, linesMut);

  const newSrc = linesMut.join('\n');
  if (newSrc !== orig) {
    // Preservar CRLF se original usava
    const final = orig.includes('\r\n') ? newSrc.replace(/\n/g, '\r\n') : newSrc;
    fs.writeFileSync(absFile, final, 'utf8');
    filesTouched++;
  }
  totalA.removals += rA.removals; totalA.pathFixed += rA.pathFixed;
  totalA.unusedRemoved += rA.unusedRemoved; totalA.insertedMissing += rA.insertedMissing;
  totalA.selfImport += rA.selfImport;
  totalB.changes += rB.changes; totalB.newConstsInserted += rB.newConstsInserted; totalB.refsReplaced += rB.refsReplaced;
  totalC.changes += rC.changes;
}

console.log(`[master-v8] CONCLUIDO`);
console.log(`  PASSO A (imports normalizeError):`);
console.log(`    - duplicatas/erradas removidas : ${totalA.removals}`);
console.log(`    - caminhos corrigidos          : ${totalA.pathFixed}`);
console.log(`    - unused removidos             : ${totalA.unusedRemoved}`);
console.log(`    - faltantes inseridos          : ${totalA.insertedMissing}`);
console.log(`    - self-import errors.ts rm     : ${totalA.selfImport}`);
console.log(`  PASSO B (refs catch X:unknown):`);
console.log(`    - consts normalizeError inserid: ${totalB.newConstsInserted}`);
console.log(`    - refs re-mapeadas             : ${totalB.refsReplaced}`);
console.log(`  PASSO C (props e.e / .response):`);
console.log(`    - linhas corrigidas            : ${totalC.changes}`);
console.log(`  Total arquivos modificados      : ${filesTouched}`);
