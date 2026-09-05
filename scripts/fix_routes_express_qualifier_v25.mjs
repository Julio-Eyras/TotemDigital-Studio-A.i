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
console.log(`[v25] Found ${files.length} route files`);

let modified = 0;

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const original = src;

  // 1) Garantir que existe import express from 'express'
  //    Se não tiver, adicionar depois do último import de 'express' tipo destruturado
  if (!/^import\s+express\s+from\s+['"]express['"];?$/m.test(src)) {
    // Encontrar último import { ... } from 'express'
    const regex = /^import\s*\{[^}]*\}\s*from\s*['"]express['"];?$/gm;
    let match;
    let lastIdx = -1;
    while ((match = regex.exec(src)) !== null) {
      lastIdx = regex.lastIndex;
    }
    const importLine = "import express from 'express';\n";
    if (lastIdx >= 0) {
      // Inserir DEPOIS do último import destruturado de express
      src = src.slice(0, lastIdx) + '\n' + importLine + src.slice(lastIdx);
    } else {
      // Inserir no topo (antes da primeira linha não-vazia que não é comentário)
      const lines = src.split('\n');
      let insertAt = 0;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) {
          insertAt = i + 1;
        } else break;
      }
      lines.splice(insertAt, 0, importLine.trim());
      src = lines.join('\n');
    }
  }

  // 2) Substituir padrões de tipos: qualificar tudo para express.

  // Ordem cuidadosa para não duplicar qualificações
  const replacements = [
    // Primeiro handlers com Promise + 3 params
    [/\(req:\s*Request,\s*res:\s*Response,\s*next:\s*NextFunction\):\s*Promise<Response\s*\|\s*void>/g,
     '(req: express.Request, res: express.Response, next: express.NextFunction): Promise<express.Response | void>'],
    // Depois handlers com Promise + 2 params
    [/\(req:\s*Request,\s*res:\s*Response\):\s*Promise<Response\s*\|\s*void>/g,
     '(req: express.Request, res: express.Response): Promise<express.Response | void>'],
    // validateRequest com 3 params retorna Response|void
    [/\(req:\s*Request,\s*res:\s*Response,\s*next:\s*NextFunction\):\s*Response\s*\|\s*void/g,
     '(req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void'],
    // Handlers com 3 params sem tipo retorno explícito
    [/\(req:\s*Request,\s*res:\s*Response,\s*next:\s*NextFunction\)/g,
     '(req: express.Request, res: express.Response, next: express.NextFunction)'],
    // Handlers com 2 params sem tipo retorno explícito
    [/\(req:\s*Request,\s*res:\s*Response\)/g,
     '(req: express.Request, res: express.Response)'],
    // Qualificar Promise<Response | void> que ainda não foi qualificado (em validateRequest)
    [/:\s*Promise<Response\s*\|\s*void>/g,
     ': Promise<express.Response | void>'],
    [/:\s*Response\s*\|\s*void/g,
     ': express.Response | void'],
  ];

  for (const [pattern, repl] of replacements) {
    src = src.replace(pattern, repl);
  }

  if (src !== original) {
    writeFileSync(f, src, 'utf8');
    modified++;
    console.log(`  [v25] Modified: ${f.replace(ROOT, '.')}`);
  }
}

console.log(`\n[v25] DONE: ${modified} files modified out of ${files.length}`);
