import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');
const ROUTES_DIR = join(ROOT, 'backend', 'src', 'routes');

function listRoutes(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...listRoutes(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = listRoutes(ROUTES_DIR);
console.log(`[v28] Found ${files.length} route files`);

let modified = 0;

/**
 * Verifica se a palavra `word` é usada no conteúdo `content` FORA de linhas de import do express.
 * Procura por ocorrências onde `word` NÃO é precedido por "express." e NÃO está dentro de `{ ... }` de um import.
 */
function isWordUsedInContent(word, content, importLine) {
  // Remover a linha de import do conteúdo para busca
  const contentClean = content.replace(importLine, ' '.repeat(importLine.length));
  
  // Checar: há ocorrência da palavra (como word boundary) que NÃO seja precedida por "express."
  // Usar múltiplas estratégias:
  // 1. "prefix" + word (ex: ": Response", ", Response", "(Response")
  // 2. word como tipo genérico: "<Response"
  // 3. Qualquer ocorrência de \bword\b que NÃO tenha "express." ANTES (na mesma linha, sem espaço)
  
  const lines = contentClean.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('import ') && line.includes("from 'express'")) continue;
    
    // Estratégia 1: substituir "express.word" por placeholder e depois procurar por \bword\b
    const cleanedLine = line.replace(new RegExp(`\\bexpress\\.${word}\\b`, 'g'), '__EXPRESS_WORD__');
    
    // Checar word boundaries
    const regex = new RegExp(`\\b${word}\\b`);
    if (regex.test(cleanedLine)) {
      return true;
    }
  }
  return false;
}

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const original = src;

  // Encontrar TODAS as linhas de import de express (destructured ou default+destructured)
  const importLines = [...src.matchAll(/^.*from\s+['"]express['"];?$/gm)].map(m => ({ match: m[0], index: m.index }));
  if (importLines.length === 0) continue;

  // Processar cada linha de import que tem destructured { ... }
  for (const { match: importLine } of importLines) {
    const destructuredMatch = importLine.match(/^((?:import\s+\w+\s*,\s*)?import\s+)?\{([^}]*)\}\s*from\s+['"]express['"];?$/);
    if (!destructuredMatch) continue;
    const items = destructuredMatch[2].split(',').map(s => s.trim()).filter(Boolean);
    
    const prefixPart = importLine.slice(0, importLine.indexOf('{')); // parte antes de "{"
    const kept = [];
    for (const item of items) {
      // Pode ser "type Request", "Request", "Router", "Response", "NextFunction"
      let isTypeQualifier = false;
      let word = item;
      if (item.startsWith('type ')) {
        isTypeQualifier = true;
        word = item.slice(5).trim();
      }
      
      if (word === 'Router') {
        kept.push(item);
        continue;
      }
      
      // Verificar se word é usado sem o prefixo express.
      const used = isWordUsedInContent(word, src, importLine);
      if (used) {
        kept.push(item);
      } else {
        console.log(`      Remove unused: ${item} in ${f.replace(ROOT, '.')}`);
      }
    }
    
    // Reconstruir a linha
    let newLine;
    if (kept.length === 0) {
      // Nenhum item mantido: se o prefixo tem "import express," ou "import express from"
      const hasDefaultImport = /^import\s+\w+\s*,\s*$/.test(prefixPart);
      if (hasDefaultImport) {
        // Trocar "import express, { } from 'express';" por "import express from 'express';"
        newLine = prefixPart.slice(0, prefixPart.lastIndexOf(',')).trimEnd() + " from 'express';";
      } else {
        newLine = '';  // Remover linha completamente
      }
    } else {
      newLine = `${prefixPart}{ ${kept.join(', ')} } from 'express';`;
    }
    
    if (newLine !== importLine) {
      src = src.replace(importLine, newLine);
    }
  }
  
  // Limpar múltiplas linhas vazias consecutivas
  src = src.replace(/\n{3,}/g, '\n\n');
  
  if (src.trim() !== original.trim()) {
    writeFileSync(f, src, 'utf8');
    modified++;
    console.log(`  [v28] Modified: ${f.replace(ROOT, '.')}`);
  }
}

console.log(`\n[v28] DONE: ${modified} files modified out of ${files.length}`);
