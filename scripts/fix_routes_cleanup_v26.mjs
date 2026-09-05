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
console.log(`[v26] Found ${files.length} route files`);

let modified = 0;

function removeUnusedImportsFromLine(importLine, fileContent) {
  // import { A, B, C } from 'express';
  const match = importLine.match(/^import\s*\{([^}]*)\}\s*from\s*['"]express['"];?$/);
  if (!match) return importLine;

  const rawItems = match[1].split(',').map(s => s.trim()).filter(Boolean);
  // Para cada item, verificar se é usado NO RESTO do arquivo (sem contar a linha de import)
  // Remover a linha de import da busca
  const contentWithoutImport = fileContent.replace(importLine, '\n'.repeat(importLine.split('\n').length));

  const kept = [];
  for (const item of rawItems) {
    // item pode ser "Request" ou "NextFunction as NF"
    const nameMatch = item.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
    if (!nameMatch) { kept.push(item); continue; }
    const originalName = nameMatch[1];
    const alias = nameMatch[2] || originalName;

    // Verificar uso: palavra boundary, excluindo a linha de import
    // Buscar por \balias\b mas não em strings/comentários (aproximação: regex simples)
    const re = new RegExp(`\\b${alias}\\b`);
    if (re.test(contentWithoutImport)) {
      kept.push(item);
    } else {
      console.log(`      Removed unused import: ${alias}`);
    }
  }

  if (kept.length === 0) {
    return ''; // remover linha completamente
  }
  return `import { ${kept.join(', ')} } from 'express';`;
}

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const original = src;

  // ===== PASSO 1: Remover Duplicate identifier 'express' =====
  // Procurar múltiplas linhas "import express from 'express';" e manter só a primeira
  const expressImportRegex = /^import\s+express\s+from\s+['"]express['"];?$/gm;
  const allExpressMatches = [...src.matchAll(expressImportRegex)];
  if (allExpressMatches.length > 1) {
    console.log(`  [v26] Duplicate express import: ${allExpressMatches.length}x in ${f.replace(ROOT, '.')}`);
    // Substituir todas as ocorrências exceto a primeira
    let foundFirst = false;
    src = src.replace(expressImportRegex, (match) => {
      if (!foundFirst) { foundFirst = true; return match; }
      return ''; // remover duplicatas
    });
    // Limpar linhas vazias em excesso no topo
    src = src.replace(/^\n{2,}/, '\n');
  }

  // ===== PASSO 2: Remover "import express from 'express';" se 'express' NÃO for usado =====
  // (apenas se não há uso de express.Router, express.Request etc)
  // Contar quantas vezes a palavra "express." aparece no arquivo
  const usageCount = (src.match(/express\./g) || []).length;
  const hasExpressDefaultRegex = /^import\s+express\s+from\s+['"]express['"];?$/m;
  if (usageCount === 0 && hasExpressDefaultRegex.test(src)) {
    console.log(`  [v26] Removing unused default 'express' import in ${f.replace(ROOT, '.')}`);
    src = src.replace(hasExpressDefaultRegex, '');
    src = src.replace(/^\n{2,}/, '\n');
  }

  // ===== PASSO 3: Limpar imports destruturados { Request, Response, NextFunction } não usados =====
  const lines = src.split('\n');
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Checar se é import { ... } from 'express'
    if (/^import\s*\{[^}]*\}\s*from\s*['"]express['"];?$/.test(line)) {
      const cleaned = removeUnusedImportsFromLine(line, src);
      if (cleaned) {
        newLines.push(cleaned);
      } else {
        console.log(`      Removed entire import line in ${f.replace(ROOT, '.')}`);
        // Pular a linha (não adicionar)
      }
    } else {
      newLines.push(line);
    }
  }
  src = newLines.join('\n');

  // ===== PASSO 4: Limpar múltiplas linhas vazias =====
  src = src.replace(/\n{3,}/g, '\n\n');

  if (src.trim() !== original.trim()) {
    writeFileSync(f, src, 'utf8');
    modified++;
    console.log(`  [v26] Modified: ${f.replace(ROOT, '.')}`);
  }
}

console.log(`\n[v26] DONE: ${modified} files modified out of ${files.length}`);
