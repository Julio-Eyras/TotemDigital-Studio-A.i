import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const routesDir = join(__dirname, '..', 'src', 'routes');

const files = readdirSync(routesDir).filter(f => f.endsWith('.ts'));

let changedFiles = 0;
let totalEdits = 0;

for (const file of files) {
  const filePath = join(routesDir, file);
  let src = readFileSync(filePath, 'utf8');
  const original = src;

  let edits = 0;

  // PADRÃO 1: import { Router, Request, Response } from 'express';
  // Se Request/Response não aparecem NO RESTO do arquivo (exceto na linha import),
  // remover do destructuring, OU trocar a linha por import { Router } from 'express'
  // ESTRATÉGIA:
  // 1) Encontrar a linha de import express destruturada
  const destructuredImportRegex = /^import\s*\{\s*([^}]*)\s*\}\s*from\s*['"]express['"];$/gm;
  let match;
  const newSrc = src.replace(destructuredImportRegex, (fullMatch, importsStr) => {
    // Parsear itens do destructuring
    const items = importsStr.split(',').map(s => s.trim()).filter(Boolean);

    // Para cada item, verificar se é usado NO RESTO do arquivo (exceto esta linha)
    // Criar versão do código SEM esta linha para checar uso
    const srcWithoutImport = src.replace(fullMatch, '');

    const keptItems = [];
    for (const item of items) {
      // Ignorar item = type-only por enquanto, tratar como nome simples
      const name = item.startsWith('type ') ? item.slice(5).trim() : item;
      // Verificar se o nome aparece em algum lugar sem ser "express.{nome}" (que é o novo qualificador)
      // Regra: manter Router, mas remover Request/Response se só aparecem como express.Request/express.Response
      if (name === 'Router') {
        keptItems.push(item);
        continue;
      }
      if (name === 'Request' || name === 'Response') {
        // Checar se existe "Request" ou "Response" sozinho no código (não precedido por "express.")
        // Regex: ocorrência da palavra sem "express." antes
        const loneRegex = new RegExp(`(?<!express\\.)\\b${name}\\b`);
        if (loneRegex.test(srcWithoutImport)) {
          keptItems.push(item);
        } else {
          edits++;
        }
        continue;
      }
      // Outros itens: manter (default, não mexer)
      keptItems.push(item);
    }

    if (keptItems.length === 0) {
      edits++;
      return `// import express default via import express from 'express' expected`; // marcador, vamos remover depois
    }
    if (keptItems.join(',') === items.join(',')) {
      return fullMatch; // sem mudanças
    }
    edits++;
    return `import { ${keptItems.join(', ')} } from 'express';`;
  });

  src = newSrc;

  // Limpar linhas de marcador que são só comentários
  src = src.replace(/^\/\/ import express default via import express from 'express' expected\n/gm, '');

  // PADRÃO 2: import express from 'express'; não usado
  // Verificar: se a palavra "express." (com ponto) NÃO aparece no código E "express[" também não,
  // E não há `typeof express` ou referências tipo express.Request,
  // Então remover a linha.
  // Como a gente acabou de QUALIFICAR tudo com express.Request etc, a palavra "express." deve aparecer.
  // Mas algumas rotas podem ter ficado sem uso. Deixemos esse pattern para depois ou TS6133 individual.

  if (src !== original) {
    writeFileSync(filePath, src, 'utf8');
    console.log(`✅ ${file}: ${edits} ajuste(s) de imports`);
    totalEdits += edits;
    changedFiles++;
  }
}

console.log(`\n📊 TOTAL LIMPEZA IMPORTS: ${changedFiles} arquivos | ${totalEdits} remoções`);
