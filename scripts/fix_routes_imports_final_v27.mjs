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
console.log(`[v27] Found ${files.length} route files`);

let modified = 0;

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const original = src;

  // =====================================================================
  // PASSO 1: Remover DUPLICATE identifier 'express'
  //   Cenário comum:
  //     import express from 'express';
  //     import express, { Request, Response, NextFunction } from 'express';
  //   Solução: Manter a linha com MAIS informações (a segunda com destructured)
  //            OU se os destruturados NÃO são usados, manter só a primeira.
  // =====================================================================
  const allExpressDefaultMatches = [...src.matchAll(/^import\s+express(?:\s*,\s*\{[^}]*\})?\s*from\s+['"]express['"];?$/gm)];
  if (allExpressDefaultMatches.length > 1) {
    console.log(`  [v27] Duplicate express: ${allExpressDefaultMatches.length}x in ${f.replace(ROOT, '.')}`);
    // Substituir todas por vazia, depois reinserir a MELHOR linha (a que tem mais conteúdo)
    let bestLine = '';
    let bestCount = 0;
    for (const m of allExpressDefaultMatches) {
      const line = m[0];
      const destructured = line.match(/\{([^}]*)\}/);
      const count = destructured ? destructured[1].split(',').filter(Boolean).length : 0;
      if (count > bestCount) {
        bestCount = count;
        bestLine = line;
      } else if (count === bestCount && line.length > bestLine.length) {
        bestLine = line;
      }
    }
    if (!bestLine) bestLine = allExpressDefaultMatches[0][0];
    // Remover TODAS as linhas de import express
    for (const m of allExpressDefaultMatches) {
      src = src.replace(m[0], '');
    }
    // Inserir a MELHOR linha no topo (antes da primeira linha não vazia/comentário)
    const lines = src.split('\n');
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) {
        insertAt = i + 1;
      } else break;
    }
    lines.splice(insertAt, 0, bestLine);
    src = lines.join('\n');
    src = src.replace(/\n{3,}/g, '\n\n');
  }

  // =====================================================================
  // PASSO 2: Verificar se Request, Response, NextFunction DESTRUTURADOS são usados
  //   (sem o prefixo "express.")  
  //   Se não forem, remover eles do import (ou a linha toda, se sobrar vazio)
  // =====================================================================
  // Analisar: procurar uso de \bRequest\b que NÃO seja precedido por "express."
  //   e que NÃO esteja na linha de import
  const srcForAnalysis = src.replace(/^import.*from\s+['"]express['"];?$/gm, '');

  const used = {
    Request: /(?<!express\.)\bRequest\b/.test(srcForAnalysis),
    Response: /(?<!express\.)\bResponse\b/.test(srcForAnalysis),
    NextFunction: /(?<!express\.)\bNextFunction\b/.test(srcForAnalysis),
    Router: /\bRouter\b/.test(srcForAnalysis),  // Router nunca é express.Router? Na verdade alguns usam, checar
  };

  // Também checar se "type Request" está sendo usado no import (type qualifier)
  const hasTypeRequestInImport = /import\s*\{[^}]*type\s+Request[^}]*\}\s*from\s*['"]express['"];?/.test(src);

  // Substituir a linha de import destructured (OU express + destructured)
  const importRegex = /^(import\s+express\s*,\s*)?\{([^}]*)\}\s*from\s+['"]express['"];?$/gm;
  let newSrc = src.replace(importRegex, (wholeLine, maybeExpressPrefix, destructuredStr) => {
    const items = destructuredStr.split(',').map(s => s.trim()).filter(Boolean);
    const kept = [];
    for (const item of items) {
      // item pode ser "type Request", "Request", "Response", "NextFunction", "Router"
      let isType = false;
      let name = item;
      const typeMatch = item.match(/^type\s+(\w+)/);
      if (typeMatch) { isType = true; name = typeMatch[1]; }

      if (name === 'Router') {
        kept.push(item);  // Sempre manter Router, é usado
        continue;
      }
      if (name === 'Request' && (used.Request || (isType && hasTypeRequestInImport))) {
        kept.push(item);
        continue;
      }
      if (name === 'Response' && used.Response) {
        kept.push(item);
        continue;
      }
      if (name === 'NextFunction' && used.NextFunction) {
        kept.push(item);
        continue;
      }
      // Caso contrário, remover (não usado)
      console.log(`      Removed unused: ${item} in ${f.replace(ROOT, '.')}`);
    }

    const prefix = maybeExpressPrefix || '';
    if (kept.length === 0) {
      // Nenhum item mantido: se tem prefix express, manter só ele
      if (maybeExpressPrefix) {
        // Deve existir import express somewhere else, pode remover a linha? 
        // Não, pois talvez a linha inteira seja a única fonte de express.
        // Verificar se no restante do arquivo há import express from 'express'
        const rest = src.replace(wholeLine, '');
        const hasStandaloneExpress = /^import\s+express\s+from\s+['"]express['"];?$/m.test(rest);
        if (hasStandaloneExpress) {
          return '';  // remover linha completamente
        } else {
          return `import express from 'express';`;
        }
      } else {
        return '';  // remover linha completamente
      }
    }

    return `${prefix}{ ${kept.join(', ')} } from 'express';`;
  });
  src = newSrc;

  // Limpar múltiplas linhas vazias
  src = src.replace(/\n{3,}/g, '\n\n');

  if (src.trim() !== original.trim()) {
    writeFileSync(f, src, 'utf8');
    modified++;
    console.log(`  [v27] Modified: ${f.replace(ROOT, '.')}`);
  }
}

console.log(`\n[v27] DONE: ${modified} files modified out of ${files.length}`);
