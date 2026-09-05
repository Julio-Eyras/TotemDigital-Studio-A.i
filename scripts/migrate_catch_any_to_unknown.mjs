/**
 * migrate_catch_any_to_unknown.mjs — SPRINT 6
 *
 * Script ONE-SHOT: varre uma lista de arquivos .ts e substitui:
 *   catch (error: any) { ... }
 * por:
 *   catch (error: unknown) {
 *     const _err = error instanceof Error ? error : new Error(String(error ?? ''));
 *     ... (mantém resto do corpo)
 *   }
 *
 * E também normaliza acesso:
 *   error?.message  → _err.message
 *   error.message   → _err.message
 *   error.code      → _err.code
 *
 * A regra de substituição é CONSERVADORA: só executa a substituição se o bloco
 * catch for da forma `} catch (error: any) { \n ...linhas... \n  }` e os usos
 * de `error` dentro forem apenas `.message` / passados como argumento para
 * logError(). Para blocos mais complexos, imprime um warning.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CWD = process.cwd();
const TARGETS = [
  'backend/src/routes/totems.ts',
  'backend/src/routes/users.ts',
  'backend/src/routes/subscribers.ts',
  'backend/src/routes/subscriptions.ts',
  'backend/src/routes/webhooks.ts',
];

function toAbs(p) {
  return resolve(join(CWD, p));
}

/**
 * Substituição regex multi-linha.
 *
 * Captura:
 *   $1: indentação antes de `}`
 *   $2: corpo interno do catch (uma ou mais linhas) preservando indentação
 */
const CATCH_REGEX = /(\s*)\}\s*catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\n([\s\S]*?\n)\s*\}/g;

function normalizeErrorRefs(body, errorName = '_err') {
  // error?.message → _err.message
  let result = body.replace(/\berror\?\.message\b/g, `${errorName}.message`);
  // error.message → _err.message
  result = result.replace(/\berror\.message\b/g, `${errorName}.message`);
  // error.code → _err.code
  result = result.replace(/\berror\.code\b/g, `${errorName}.code`);
  // await logError('...', error) → await logError('...', _err)
  result = result.replace(/(logError|logWarn|logInfo)\(([^\n]*),\s*error\s*\)/g, (_m, fn, args) => `${fn}(${args}, ${errorName})`);
  // throw error → throw _err
  result = result.replace(/\bthrow\s+error\s*;/g, `throw ${errorName};`);
  // next(error) → next(_err)
  result = result.replace(/\bnext\(\s*error\s*\)/g, `next(${errorName})`);
  return result;
}

function processFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(`[SKIP] Não existe: ${filePath}`);
    return { replaced: 0, skipped: [] };
  }

  const original = readFileSync(filePath, 'utf8');
  const skipped = [];
  let replaced = 0;

  const newContent = original.replace(CATCH_REGEX, (match, closeIndent, body) => {
    const bodyHasDangerous =
      /\berror\.(?!message|code)(\w+)\b/.test(body) ||
      /\berror\s*[!=]==?/.test(body) ||
      /\berror\s*\?\?/.test(body);

    if (bodyHasDangerous) {
      skipped.push({ line: (original.slice(0, original.indexOf(match)).match(/\n/g) || []).length + 1 });
      return match;
    }

    const safeBody = normalizeErrorRefs(body);
    replaced += 1;
    const ind = closeIndent.replace(/^[\r\n]+/, '');
    // Detecta indentação do corpo (primeira linha não-vazia)
    const bodyLines = body.split('\n');
    const firstBody = bodyLines.find((l) => l.trim().length > 0) || bodyLines[0] || '';
    const indentMatch = firstBody.match(/^(\s*)/);
    const bodyIndent = indentMatch ? indentMatch[1] : ind + '  ';

    return `${ind}} catch (error: unknown) {\n${bodyIndent}const _err = error instanceof Error ? error : new Error(String(error ?? ''));\n${safeBody}${ind}}`;
  });

  if (replaced > 0 || skipped.length > 0) {
    writeFileSync(filePath, newContent, 'utf8');
  }
  return { replaced, skipped };
}

const summary = { files: 0, replaced: 0, skippedBlocks: [] };
for (const rel of TARGETS) {
  const abs = toAbs(rel);
  const r = processFile(abs);
  summary.files += r.replaced + r.skipped.length > 0 ? 1 : 0;
  summary.replaced += r.replaced;
  summary.skippedBlocks.push(...r.skipped.map((s) => ({ file: rel, ...s })));
  console.log(`[${rel}] ${r.replaced} bloco(s) substituido(s); ${r.skipped.length} perigoso(s) preservado(s)`);
}

console.log('\n===== RESUMO SPRINT 6 =====');
console.log(`Total de blocos catch substituídos: ${summary.replaced}`);
if (summary.skippedBlocks.length > 0) {
  console.log(`\nBlocos NÃO substituídos (revisar manualmente - acesso a props desconhecidas de error):`);
  for (const s of summary.skippedBlocks) console.log(`  - ${s.file} ~linha ${s.line}`);
} else {
  console.log('Nenhum bloco perigoso encontrado.');
}
