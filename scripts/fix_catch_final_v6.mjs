/**
 * fix_catch_final_v6.mjs — SPRINT 6 FASE 3.4
 *
 * 2 categorias de erros restantes pós typecheck:
 *   A) TS6133: 'e' is declared but its value is never read. (quando body do catch não usa `e` nada)
 *      → se `catch (error: unknown) { const e = normalizeError(error); ... }` sem NENHUMA referência a `e.` / `e ` / `e,` → remover const e.
 *   B) TS2339: Propriedade X does not exist on type '{}' ou similares para acessos raw Postgres:
 *        e.statusCode / e.detail / e.code / e.stack / etc onde a prop é acessada via tipo errado
 *      → trocar por cast seguro em (e.raw as { ... }) quando necessário
 *
 * Parser contagem-chaves + substituições conservativas.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CWD = process.cwd();

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    const abs = join(dir, f);
    const s = statSync(abs);
    if (s.isDirectory()) {
      if (f !== 'node_modules') walk(abs, acc);
    } else if (f.endsWith('.ts')) acc.push(abs);
  }
  return acc;
}

function findCatchBlocks(text) {
  const blocks = [];
  const re = /catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const openIdx = m.index + m[0].length - 1; // posição do `{`
    let brace = 1;
    let i = openIdx + 1;
    while (i < text.length && brace > 0) {
      const ch = text.charCodeAt(i);
      if (ch === 123 /*{*/) brace++;
      else if (ch === 125 /*}*/) { brace--; if (brace === 0) break; }
      i++;
    }
    const closeIdx = i;
    blocks.push({
      start: m.index,
      open: openIdx,
      close: closeIdx,
      match: m[0],
      body: text.slice(openIdx + 1, closeIdx),
      full: text.slice(m.index, closeIdx + 1),
    });
  }
  return blocks;
}

function rewriteBlock(block) {
  let body = block.body;
  let changed = false;

  // Extrai a linha `const e = normalizeError(error);`
  const constELineRe = /^([ \t]*)const\s+e\s*=\s*normalizeError\s*\(\s*error\s*\)\s*;\s*\n?/m;
  const constELineMatch = body.match(constELineRe);
  const hasConstE = !!constELineMatch;

  // Conta refs a `e` no body (excluindo a linha `const e = ...` e match em palavras com `e` como substring)
  // Abordagem: contar ocorrências de `\be\b[\.\,\)\;\:]` onde não é parte de outra palavra
  const bodyWithoutConstE = hasConstE ? body.replace(constELineRe, '') : body;
  const eRefsCount = countERefs(bodyWithoutConstE);

  if (hasConstE && eRefsCount === 0) {
    // Remover linha const e inteira
    body = body.replace(constELineRe, (m) => { changed = true; return ''; });
  }

  // B) Consertar refs que são acessadas via tipo errado
  // Trocar `e.statusCode` onde pode ser que TS reclame de tipo `{}` → (e.raw as { statusCode?: number }).statusCode
  body = body.replace(/\be\.statusCode\b/g, () => { changed = true; return '(e.raw as { statusCode?: number })?.statusCode'; });
  body = body.replace(/\be\.detail\b/g, () => { changed = true; return '(e.raw as { detail?: string })?.detail'; });
  body = body.replace(/\be\.stack\b/g, () => { changed = true; return '(e.raw as { stack?: string })?.stack'; });
  body = body.replace(/\be\.constraint\b/g, () => { changed = true; return '(e.raw as { constraint?: string })?.constraint'; });
  body = body.replace(/\be\.table\b/g, () => { changed = true; return '(e.raw as { table?: string })?.table'; });
  body = body.replace(/\be\.column\b/g, () => { changed = true; return '(e.raw as { column?: string })?.column'; });

  // Garantir que se `error` ainda aparecer em uso que não instanceof / ternário → substituir safe
  if (/\berror\s*instanceof\b/.test(body) || !/\berror\b/.test(body)) {
    // OK: error só usado em instanceof check
  } else {
    // Tratar error restantes (exceto na assinatura do catch)
    body = body.replace(/\berror\s*,\s*error\b/g, (m) => { changed = true; return m; });
  }

  return { body, changed };
}

function countERefs(text) {
  let count = 0;
  const re = /\be\b(?=[\.\,\)\;\:\?\]\}])/g;
  let m;
  while ((m = re.exec(text)) !== null) count++;
  return count;
}

const files = walk(resolve(CWD, 'backend/src'));
let fileChanges = 0;
let totalBlockChanges = 0;

for (const f of files) {
  const original = readFileSync(f, 'utf-8');
  if (!/catch\s*\(\s*error\s*:\s*unknown\s*\)/.test(original)) continue;
  const blocks = findCatchBlocks(original).sort((a, b) => b.start - a.start);
  if (blocks.length === 0) continue;
  let result = original;
  let fileChanged = false;
  for (const blk of blocks) {
    const { body, changed } = rewriteBlock(blk);
    if (changed) {
      const newFull = blk.full.replace(blk.body, body);
      result = result.slice(0, blk.start) + newFull + result.slice(blk.close + 1);
      fileChanged = true;
      totalBlockChanges++;
    }
  }
  if (fileChanged) {
    writeFileSync(f, result, 'utf-8');
    fileChanges++;
  }
}

console.log(`fix v6: arquivos atualizados: ${fileChanges} | blocos modificados: ${totalBlockChanges}`);
