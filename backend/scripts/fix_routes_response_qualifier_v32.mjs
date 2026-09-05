import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const routesDir = join(__dirname, '..', 'src', 'routes');

const files = readdirSync(routesDir).filter(f => f.endsWith('.ts'));

let totalEdits = 0;
let changedFiles = 0;

for (const file of files) {
  const filePath = join(routesDir, file);
  let src = readFileSync(filePath, 'utf8');
  const original = src;

  // Skip se não tem import express (senão vai quebrar tipo)
  if (!src.includes("import express from 'express'")) {
    // Alguns usam import * as express? Vamos checar.
    if (!src.includes("import * as express")) continue;
  }

  // 1) Substituir `: Response`  por `: express.Response` (excluindo Response já qualificado)
  // Negative lookbehind: NÃO precedido por "express."
  // Negative lookahead: NÃO seguido por "/" ou "|" ou parte de ResponseType etc
  let editsThisFile = 0;
  
  const resRegex = /: Response(?![a-zA-Z0-9_.])/g;
  const resMatches = src.match(resRegex);
  if (resMatches) {
    src = src.replace(resRegex, ': express.Response');
    editsThisFile += resMatches.length;
  }

  // 2) Substituir `(req: Request` / `, req: Request` / `_req: Request` por com express.Request
  // Cuidado para NÃO substituir AuthenticatedRequest (que contém "Request" no nome)
  // Melhor: substituir apenas "Request" quando precedido por ": " e não tem "Authenticated" antes
  // Usamos duas regex:
  // a) `: Request(` ou `: Request,` ou `: Request)` ou `: Request:` ou `: Request `
  const reqRegex = /(?<!Authenticated): Request(?![a-zA-Z0-9_])/g;
  const reqMatches = src.match(reqRegex);
  if (reqMatches) {
    src = src.replace(reqRegex, ': express.Request');
    editsThisFile += reqMatches.length;
  }

  // 3) Substituir `next: any` em validateRequest → next: express.NextFunction
  const nextRegex = /next: any/g;
  const nextMatches = src.match(nextRegex);
  if (nextMatches) {
    src = src.replace(nextRegex, 'next: express.NextFunction');
    editsThisFile += nextMatches.length;
  }

  // 4) Substituir `_req: any` → _req: express.Request
  const reqAnyRegex = /_req: any/g;
  const reqAnyMatches = src.match(reqAnyRegex);
  if (reqAnyMatches) {
    src = src.replace(reqAnyRegex, '_req: express.Request');
    editsThisFile += reqAnyMatches.length;
  }

  // 5) Substituir `req: any` → req: express.Request (exceto dentro de comentários? por enquanto geral, seguro)
  const reqAnyRegex2 = /(?<!_)req: any(?![a-zA-Z])/g;
  const reqAnyMatches2 = src.match(reqAnyRegex2);
  if (reqAnyMatches2) {
    src = src.replace(reqAnyRegex2, 'req: express.Request');
    editsThisFile += reqAnyMatches2.length;
  }

  if (src !== original) {
    writeFileSync(filePath, src, 'utf8');
    console.log(`✅ ${file}: ${editsThisFile} alterações`);
    totalEdits += editsThisFile;
    changedFiles++;
  }
}

console.log(`\n📊 TOTAL: ${changedFiles} arquivos alterados | ${totalEdits} substituições`);
