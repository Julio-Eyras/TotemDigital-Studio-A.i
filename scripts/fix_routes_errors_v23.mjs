import fs from 'fs';
import path from 'path';

const SRC = path.resolve(process.cwd(), 'backend/src/routes');

const patterns = [
  {
    desc: 'Remove unused NextFunction warning (arquivos sem validateRequest: trocar import se NextFunction não usado)',
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walk(full, files);
    } else if (entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC);
console.log(`[v23] Processing ${files.length} route files`);

let fixed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const before = content;

  // 1. NextFunction is declared but never read → remove from import
  // Pattern: import { Router, Request, Response, NextFunction } from 'express';
  if (/import \{[^}]*NextFunction[^}]*\} from ['"]express['"]/.test(content) &&
      !content.includes('NextFunction) =>') && !content.includes('next: NextFunction')) {
    content = content.replace(
      /import \{([^}]*),?\s*NextFunction\s*,?([^}]*)\} from ['"](express)['"];?/gm,
      (m, g1, g2) => {
        let items = (g1 + ',' + g2).split(',').map(s => s.trim()).filter(Boolean);
        items = [...new Set(items)];
        return `import { ${items.join(', ')} } from 'express';`;
      }
    );
  }

  // 1b. Request unused
  if (/import \{[^}]*Request[^}]*\} from ['"]express['"]/.test(content) &&
      !content.includes('req: Request') && !content.includes('(req: Request')) {
    content = content.replace(
      /import \{([^}]*),?\s*Request\s*,?([^}]*)\} from ['"](express)['"];?/gm,
      (m, g1, g2) => {
        let items = (g1 + ',' + g2).split(',').map(s => s.trim()).filter(Boolean);
        items = [...new Set(items)];
        return `import { ${items.join(', ')} } from 'express';`;
      }
    );
  }

  // 2. validateRequest retorno void → Response | void quando tem return res.status
  // Pattern: const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Change ': void' to ': Response | void'
  content = content.replace(
    /const validateRequest = \(req: Request, res: Response, next: NextFunction\): void => \{/g,
    `const validateRequest = (req: Request, res: Response, next: NextFunction): Response | void => {`
  );

  // 3. Custom normalizeXxxBody middlewares mesmo problema void
  content = content.replace(
    /const (\w+) = \(req: Request, (\w+): Response, next: NextFunction\): void => \{/g,
    `const $1 = (req: Request, $2: Response, next: NextFunction): Response | void => {`
  );

  // 4. Cannot find name NextFunction - ocorre quando o import não tem NextFunction
  // mas há next: NextFunction
  if (content.includes('next: NextFunction') &&
      !/import \{[^}]*NextFunction[^}]*\} from ['"]express['"]/.test(content)) {
    // Add NextFunction ao import existente de express
    content = content.replace(
      /import \{([^}]+)\} from ['"](express)['"];?/m,
      (match, g1) => {
        if (g1.includes('NextFunction')) return match;
        return `import { ${g1.trim()}, NextFunction } from 'express';`;
      }
    );
  }

  // 5. TS2769: No overload matches - problema com Request tipo vs ParamsDictionary
  // Causa: import { Router, Request, Response } mas os tipos generics do router
  // são conflitantes com Request direto. Solução: trocar (req: Request, res: Response)
  // por (req: any, res: any) apenas em casos extremos? NÃO. Alternativa melhor:
  // usar express.Request e express.Response qualificado. OU: adicionar tipo alias
  // no topo `type EReq = express.Request; type ERes = express.Response;` - nah.
  // Melhor abordagem: se arquivo usa import express.Router() → trocar types para
  // `express.Request` / `express.Response` / `express.NextFunction`
  // Padrão: arquivo começa com `import express from 'express'` ou `const router = express.Router()`
  const usesExpressQualifier = content.includes('express.Router');
  if (usesExpressQualifier) {
    content = content.replace(/\(req: Request, res: Response\)/g, `(req: express.Request, res: express.Response)`);
    content = content.replace(/\(req: Request, res: Response\): Promise<Response \| void>/g, `(req: express.Request, res: express.Response): Promise<express.Response | void>`);
    content = content.replace(/\(req: Request, res: Response, next: NextFunction\): Response \| void/g,
      `(req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void`);
    content = content.replace(/next: NextFunction/g, `next: express.NextFunction`);
  }

  if (content !== before) {
    fs.writeFileSync(file, content, 'utf8');
    fixed++;
    console.log(`  [fixed] ${path.basename(file)}`);
  }
}

console.log(`[v23] Done. ${fixed} files modified.`);
