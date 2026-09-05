import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = resolve(process.cwd(), 'backend/src');
const ERRORS_PATH = resolve(ROOT, 'utils/errors.ts');
const exts = ['.ts'];
const skipDirs = new Set(['node_modules', '__tests__', 'dist', '.git']);

function walk(dir, out = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const p = resolve(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (skipDirs.has(entry)) continue;
      walk(p, out);
    } else if (s.isFile() && exts.some(e => entry.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

function relImportFor(fileAbs) {
  const fromDir = dirname(fileAbs).split(sep);
  const toDir = dirname(ERRORS_PATH).split(sep);
  let i = 0;
  while (i < fromDir.length && i < toDir.length && fromDir[i] === toDir[i]) i++;
  const updirs = fromDir.length - i;
  let rel = '';
  for (let k = 0; k < updirs; k++) rel += '../';
  const rest = toDir.slice(i).join('/');
  if (rest) rel += rest + '/';
  rel += 'errors';
  return rel;
}

const files = walk(ROOT);
let nFixed = 0;

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  let changed = false;

  // ==== PASSO 1: REMOVER TODAS as linhas "import { normalizeError } ..." ====
  // Remove linhas INTEIRAS (ou inline)
  const beforeRemove = src;
  src = src.replace(/^[ \t]*import\s*\{\s*normalizeError\s*\}[^;\n]*;[ \t]*\n?/gm, () => { changed = true; return ''; });
  // Também remover casos inline onde a linha tem "import {" + newline + "import { normalizeError }" newline
  src = src.replace(/\n[ \t]*import\s*\{\s*normalizeError\s*\}[^;\n]*;?[ \t]*(?=\n)/g, () => { changed = true; return ''; });

  // ==== PASSO 2: VERIFICAR SE AINDA HÁ USO de normalizeError( ====
  if (!/normalizeError\s*\(/.test(src)) {
    if (changed) writeFileSync(f, src, 'utf8');
    continue;
  }

  // ==== PASSO 3: INSERIR IMPORT CORRETO no FIM DO BLOCO DE IMPORTS ====
  // Encontrar posição: última linha "import X from 'Y';" no cabeçalho
  // Não pode ser dentro de outro import. Encontrar todo import statement (incluindo multilinha)
  // Abordagem simples: pular linhas de comentários header, depois encontrar o fim do último import
  const lines = src.split('\n');
  let lastImportLine = -1;
  let inMultiLineImport = false;
  let multiLineStartBraceCount = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx];
    if (!inMultiLineImport) {
      // Possível início de import
      if (/^\s*import\s+/.test(l)) {
        // Verifica se é import multilinha (abre { sem fechar na mesma linha)
        const open = (l.match(/\{/g) || []).length;
        const close = (l.match(/\}/g) || []).length;
        if (open > close) {
          inMultiLineImport = true;
          multiLineStartBraceCount = open - close;
        } else if (/;\s*$/.test(l)) {
          lastImportLine = idx;
        }
      } else if (l.trim().length > 0 && !/^\s*\/\//.test(l) && !/^\s*\/\*/.test(l)) {
        // Linha não-vazia que não é import nem comentário → parar
        break;
      }
    } else {
      // Estamos dentro de import multilinha. Contar chaves.
      const open = (l.match(/\{/g) || []).length;
      const close = (l.match(/\}/g) || []).length;
      multiLineStartBraceCount += (open - close);
      if (multiLineStartBraceCount <= 0 && /;\s*$/.test(l)) {
        inMultiLineImport = false;
        lastImportLine = idx;
      }
    }
  }

  if (lastImportLine >= 0) {
    const correctRel = relImportFor(f);
    const newImport = `import { normalizeError } from '${correctRel}';`;
    // Inserir DEPOIS da última linha de import
    lines.splice(lastImportLine + 1, 0, newImport);
    src = lines.join('\n');
    changed = true;
  } else {
    // Caso nenhum import no arquivo: inserir no começo (depois de comentários header)
    console.log('AVISO: sem imports base - pulando', f);
  }

  if (changed) {
    writeFileSync(f, src, 'utf8');
    nFixed++;
  }
}

console.log('===== CORREÇÃO IMPORTS NORMALIZE ERROR =====');
console.log('Arquivos corrigidos:', nFixed);
process.exit(0);
