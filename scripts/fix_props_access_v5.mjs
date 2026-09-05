/**
 * fix_props_access_v5.mjs — SPRINT 6 FASE 3.3
 *
 * Corrige refs pós-normalizeError onde:
 *   error.stack → e.error.stack     (mas v4 já fez, porém se `(e.raw as {xxx}).xxx` tem cast tipo {} falha)
 *
 * Problemas restantes do último tsc:
 * 1) `e.statusCode`  → não existe em NormalizedError sem cast; trocar por `(e.raw as { statusCode?: number }).statusCode`
 *    Mesma ideia para: detail / code / constraint / table / column / stack / message
 * 2) `void const e` / TS6133: se `e` declarado mas nunca usado → remover declaração e usar `catch` vazio
 * 3) `error` em literals `${error}` (v4 pegou a maioria, mas não em contextos mais complexos)
 *
 * Como todos os arquivos já têm `catch (error: unknown)` e `const e = normalizeError(error)`,
 * podemos rodar regex em nível de conteúdo.
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

/**
 * Em um bloco que CONTÉM `const e = normalizeError(error);`:
 *   Troca refs que não foram cobertas por v4.
 *
 * Como v4 injetou `e.` em muitas props, mas algumas como statusCode / detail são
 * acessadas como `e.statusCode` (propriedade NÃO existe em NormalizedError —
 * sim! STATUSCODE existe em errors.ts então statusCode está OK. Vamos checar o
 * arquivo errors.ts mais tarde. Em vez disso, vamos apanhar TS2339 genericamente.
 *
 * Aqui fazemos trocas conservativeis:
 */
function fixContent(original) {
  let c = original;
  // 1. statusCode: se o tipo for e.statusCode → existe em NormalizedError. Mas acessar (e as any).statusCode? Melhor deixar.
  //    Erros TS2339 restantes são EM `{}` ou tipo unknown, o que significa que a var ainda é `error` não mapeado, ou
  //    acessos em (e.raw as {xxx}).xxx com tipo diferente. Em vez de regex genérico, tratar casos mais comuns.
  // Trocar `error.stack` → `(e.error as Error).stack` caso o v4 não pegou (em catch(unknown) ainda tem refs a `error.`)
  c = c.replace(/\bcatch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{([\s\S]*?)\n\s*\}/g, (match) => {
    let body = match;
    // Em blocos catch unknown: qualquer `error.` que sobrou → substituir por acessos via e
    body = body.replace(/\berror\.stack\b/g, 'e.error.stack');
    body = body.replace(/\berror\.message\b/g, 'e.message');
    body = body.replace(/\berror\.code\b/g, 'e.code');
    body = body.replace(/\berror\.name\b/g, 'e.error.name');
    body = body.replace(/\berror\.statusCode\b/g, '(e.raw as { statusCode?: number }).statusCode');
    body = body.replace(/\berror\.detail\b/g, '(e.raw as { detail?: string }).detail');
    body = body.replace(/\berror\.constraint\b/g, '(e.raw as { constraint?: string }).constraint');
    body = body.replace(/\berror\.table\b/g, '(e.raw as { table?: string }).table');
    body = body.replace(/\berror\.column\b/g, '(e.raw as { column?: string }).column');
    body = body.replace(/\berror\.cause\b/g, '(e.raw as { cause?: unknown }).cause');
    // Qualquer error.whatever restante (exceto funções conhecidas): cast safe
    body = body.replace(/\berror\.(\w+)\b/g, (_m, prop) => {
      if (['message', 'code', 'stack', 'name'].includes(prop)) return _m;
      return `(e.raw as { ${prop}?: unknown }).${prop}`;
    });
    // Refs a `error` sozinho em template string / concat
    body = body.replace(/\$\{\s*error\s*\}/g, '${e.message}');
    body = body.replace(/\+\s*error\s*\+/g, '+ e.message +');
    body = body.replace(/\+\s*error\s*$/gm, '+ e.message');
    body = body.replace(/^\s*error\s*\+/gm, 'e.message +');
    // callback(error, ...)
    body = body.replace(/\bcallback\(\s*error\s*,/g, 'callback(e.error,');
    // cb(error, ...)
    body = body.replace(/\bcb\(\s*error\s*,/g, 'cb(e.error,');
    // resolve(error) / reject(error)
    body = body.replace(/\breject\(\s*error\s*\)/g, 'reject(e.error)');
    body = body.replace(/\bresolve\(\s*error\s*\)/g, 'resolve(e.error)');
    // Promise.reject(error)
    body = body.replace(/Promise\.reject\(\s*error\s*\)/g, 'Promise.reject(e.error)');
    // JSON.stringify(error) etc
    body = body.replace(/JSON\.(stringify|parse)\(\s*error\s*\)/g, (_m, fn) => `JSON.${fn}(e.raw as object)`);
    // typeof error ===
    body = body.replace(/typeof\s+error\s*===/g, 'typeof e.raw ===');
    // if (error) ...
    body = body.replace(/\bif\s*\(\s*error\s*\)/g, 'if (e.raw)');
    body = body.replace(/\bif\s*\(\s*!\s*error\s*\)/g, 'if (!e.raw)');
    // `e` unused — remove const e linha se NÃO tem `e.` ou `e ` no corpo (usar para logs vazios etc)
    // Verifica se corpo tem referência a `e` após a linha `const e = normalizeError(error);`
    return body;
  });
  return c;
}

const files = walk(resolve(CWD, 'backend/src'));
let changed = 0;
for (const f of files) {
  const original = readFileSync(f, 'utf-8');
  if (!/catch\s*\(\s*error\s*:\s*unknown\s*\)/.test(original)) continue;
  const fixed = fixContent(original);
  if (fixed !== original) {
    writeFileSync(f, fixed, 'utf-8');
    changed++;
  }
}
console.log(`fix v5: arquivos atualizados: ${changed}`);
