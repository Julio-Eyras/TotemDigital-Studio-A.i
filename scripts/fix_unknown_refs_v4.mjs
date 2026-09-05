/**
 * fix_unknown_refs_v4.mjs — SPRINT 6 FASE 3.2
 *
 * Muitos arquivos ainda têm refs a `error.message` FORA do padrão que o v3 capturou:
 * ex. `error.message` aparece em literais template, concatenação, `.includes(error.message)`
 * etc. Este script transforma QUALQUER `error.message` / `error.code` / `error.stack`
 * que exista DENTRO de um bloco `catch (error: unknown)` mapeado, e também troca
 * refs em `error` soltas que ainda são unknown.
 *
 * Também conserta:
 *  - `throw new Error('...', { cause: error })` → `cause: e.error`
 *  - `Promise.reject(error)` → `Promise.reject(e.error)`
 *  - `reject(error)` → `reject(e.error)`
 *  - `new Error(error.message)` → `new Error(e.message)`
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const CWD = process.cwd();

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    const abs = join(dir, f);
    const s = statSync(abs);
    if (s.isDirectory()) {
      if (f !== 'node_modules') walk(abs, acc);
    } else if (f.endsWith('.ts')) {
      acc.push(abs);
    }
  }
  return acc;
}

function containsCatchErrorUnknown(content) {
  return /catch\s*\(\s*error\s*:\s*unknown\s*\)/.test(content);
}

function containsNormalizeImport(content) {
  return content.includes("from '../utils/errors'") || content.includes('from "./errors"') || content.includes('from "../../utils/errors"');
}

function ensureNormalizeImport(content, filePath) {
  if (containsNormalizeImport(content)) return content;
  const fileDir = dirname(filePath);
  const errorsAbs = resolve(fileDir, '../utils/errors');
  let rel = relative(fileDir, errorsAbs).replace(/\\/g, '/').replace(/\.ts$/, '');
  if (!rel.startsWith('.') && !rel.startsWith('/')) rel = './' + rel;
  const importLine = `import { normalizeError } from '${rel}';\n`;
  const importLines = content.match(/^import .+;$/gm) || [];
  if (importLines.length === 0) return importLine + content;
  const lastImport = importLines[importLines.length - 1];
  return content.replace(lastImport, lastImport + '\n' + importLine.replace(/\n$/, ''));
}

/**
 * Divide conteúdo em array [{ type: 'catch', body, ind, catchLine } | { type: 'text', text }]
 * percorrendo de forma a não sobrescrever blocos.
 */
function splitCatches(content) {
  const re = /(\s*)\}\s*catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{/g;
  const pieces = [];
  let last = 0;
  let m;
  while ((m = re.exec(content)) !== null) {
    const catchStart = m.index;
    if (catchStart > last) {
      pieces.push({ type: 'text', text: content.slice(last, catchStart) });
    }
    // Busca fechamento do bloco (contagem de chaves aninhadas)
    let depth = 1;
    let i = m.index + m[0].length;
    while (depth > 0 && i < content.length) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      if (depth === 0) break;
      i++;
    }
    const bodyStart = m.index + m[0].length;
    const bodyEnd = i;
    const body = content.slice(bodyStart, bodyEnd);
    // Posição do primeiro não-espaço para inserir `const e = normalizeError(error);`
    const ind = m[1] ? m[1].replace(/^[\r\n]+/, '') + '  ' : '  ';
    pieces.push({ type: 'catch', body, ind, closeBraceIdx: bodyEnd });
    last = bodyEnd + 1;
    re.lastIndex = last;
  }
  if (last < content.length) pieces.push({ type: 'text', text: content.slice(last) });
  return pieces;
}

function rewriteBody(body, ind) {
  let b = body;
  // Todas as refs a error.XXX → e.XXX (ou e.error.XXX para stack/name)
  b = b.replace(/\berror\?\.message\b/g, 'e.message');
  b = b.replace(/\berror\.message\b/g, 'e.message');
  b = b.replace(/\berror\?\.code\b/g, 'e.code');
  b = b.replace(/\berror\.code\b/g, 'e.code');
  b = b.replace(/\berror\.stack\b/g, 'e.error.stack');
  b = b.replace(/\berror\.name\b/g, 'e.error.name');
  b = b.replace(/\berror\.cause\b/g, '(e.raw as { cause?: unknown }).cause');
  b = b.replace(/\berror\.detail\b/g, '(e.raw as { detail?: string }).detail');
  b = b.replace(/\berror\.constraint\b/g, '(e.raw as { constraint?: string }).constraint');
  b = b.replace(/\berror\.table\b/g, '(e.raw as { table?: string }).table');
  b = b.replace(/\berror\.column\b/g, '(e.raw as { column?: string }).column');
  // error em JSON.stringify(error)
  b = b.replace(/JSON\.stringify\(\s*error\s*\)/g, 'JSON.stringify(e.raw)');
  // Object.keys(error), Object.values(error)
  b = b.replace(/Object\.(keys|values|entries)\(\s*error\s*\)/g,
    (_m, fn) => `Object.${fn}(e.raw as Record<string, unknown>)`);
  // throw new Error(msg, { cause: error })
  b = b.replace(/new\s+Error\(\s*([^)]*)\)\s*,\s*\{\s*cause\s*:\s*error\s*\}/g,
    (_m, inner) => `new Error(${inner}, { cause: e.error })`);
  // throw error
  b = b.replace(/\bthrow\s+error\s*;/g, 'throw e.error;');
  // Promise.reject(error)
  b = b.replace(/Promise\.reject\(\s*error\s*\)/g, 'Promise.reject(e.error)');
  // reject(error)  (dentro de new Promise( (res, reject) => {...})  — pattern comum
  b = b.replace(/\breject\(\s*error\s*\)/g, 'reject(e.error)');
  // reject(new Error(error.message, ...))
  b = b.replace(/new\s+Error\(\s*error\.message\s*,/g, 'new Error(e.message,');
  // logError/Warn/Info(..., error)
  b = b.replace(/(logError|logWarn|logInfo|logDebug)\(([^\n]*?),\s*error\s*\)/g,
    (_m, fn, args) => `${fn}(${args}, e.error)`);
  b = b.replace(/(logError|logWarn|logInfo|logDebug)\(([^\n]*?),\s*error\s*,\s*\{/g,
    (_m, fn, args) => `${fn}(${args}, e.error, {`);
  // console.log / error / warn
  b = b.replace(/(console\.(?:log|error|warn|info))\(([^\n]*?),\s*error\s*\)/g,
    (_m, fn, args) => `${fn}(${args}, e.error)`);
  // next(error)
  b = b.replace(/\bnext\(\s*error\s*\)/g, 'next(e.error)');
  // callback(error)
  b = b.replace(/\bcallback\(\s*error\s*\)/g, 'callback(e.error)');
  // cb(error)
  b = b.replace(/\bcb\(\s*error\s*\)/g, 'cb(e.error)');
  // isDatabaseError(error)
  b = b.replace(/\bisDatabaseError\(\s*error\s*\)/g, 'isDatabaseError(e.raw)');
  b = b.replace(/\bisUniqueViolationError\(\s*error\s*\)/g, 'isUniqueViolationError(e.raw)');
  // error === xxx  (raro, mas transformar em e.error ===)
  b = b.replace(/\berror\s*(===|!==|==|!=)\s*/g, 'e.error $1 ');
  // spread error
  b = b.replace(/\.\.\.\s*error\b/g, '...(e.raw as object)');
  // error em `${error}`
  b = b.replace(/\$\{\s*error\s*\}/g, '${e.message}');
  // ``error`` em concatenação
  b = b.replace(/\+\s*error\s*\+/g, '+ e.message +');
  // `.includes(error.message)` já tratado acima mas confirmar: noop
  // Adicionar `const e = normalizeError(error);` caso não exista
  if (!/\bconst\s+e\s*=\s*normalizeError\(error\)/.test(b)) {
    // Detecta indentação da primeira linha não vazia
    const firstLine = b.split('\n').find((l) => l.trim().length > 0) || '';
    const match = firstLine.match(/^(\s*)/);
    const prefix = match ? match[1] : ind;
    b = prefix + 'const e = normalizeError(error);\n' + b;
  }
  return b;
}

function processFile(filePath) {
  if (!existsSync(filePath)) return { changed: false, fixes: 0 };
  const original = readFileSync(filePath, 'utf-8');
  if (!containsCatchErrorUnknown(original)) return { changed: false, fixes: 0 };
  const pieces = splitCatches(original);
  let catches = 0;
  const rebuilt = pieces.map((p) => {
    if (p.type === 'text') return p.text;
    catches += 1;
    return '} catch (error: unknown) {' + rewriteBody(p.body, p.ind) + '}';
  }).join('');
  let final = rebuilt;
  if (catches > 0) {
    final = ensureNormalizeImport(final, filePath);
  }
  const changed = final !== original;
  if (changed) writeFileSync(filePath, final, 'utf-8');
  return { changed, fixes: catches };
}

const files = walk(resolve(CWD, 'backend/src'));
let tot = 0, changed = 0;
for (const f of files) {
  const r = processFile(f);
  if (r.changed) {
    changed += 1;
    tot += r.fixes;
    const rel = relative(CWD, f).replace(/\\/g, '/');
    console.log(`[FIX] ${rel} — ${r.fixes} catch(unknown) resgatado(s)`);
  }
}
console.log(`\n===== FIX v4 =====`);
console.log(`Arquivos com refs corrigidas: ${changed}`);
console.log(`Total de blocos catch(unknown) com refs de error remapeadas: ${tot}`);
