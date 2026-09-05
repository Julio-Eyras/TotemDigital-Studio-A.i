import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BACKEND_SRC = path.join(ROOT, 'backend', 'src');
const ROUTES_DIR = path.join(BACKEND_SRC, 'routes');

const filesWithAny = process.argv.slice(2);
if (filesWithAny.length === 0) {
  console.error('Usage: node fix_routes_residual_any_v30.mjs <file1> <file2> ...');
  process.exit(1);
}

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return { file: filePath, skipped: 'not found' };
  const rel = path.relative(ROOT, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1) Se não tiver import express from 'express'; adicionar
  if (!/^import\s+express\s+from\s+['"]express['"];?\s*$/m.test(content)) {
    // adicionar depois do último import de express existente
    content = content.replace(
      /^(import\s+\{\s*[^}]*\}\s+from\s+['"]express['"];?)\s*$/m,
      (match) => `${match}\nimport express from 'express';`
    );
  }

  // 2) Substituir req: any e res: Response qualificados
  // async (req: any, res: Response) =>
  content = content.replace(
    /\basync\s*\(\s*req\s*:\s*any\s*,\s*res\s*:\s*Response\s*\)/g,
    'async (req: express.Request, res: express.Response)'
  );
  // (req: any, res: Response) => (não-async)
  content = content.replace(
    /\(\s*req\s*:\s*any\s*,\s*res\s*:\s*Response\s*\)/g,
    '(req: express.Request, res: express.Response)'
  );
  // handlers com apenas (req: any)
  content = content.replace(
    /\(\s*req\s*:\s*any\s*\)/g,
    '(req: express.Request)'
  );

  // 3) Filtros any: `let filters: any = {}` → Record<string, unknown>
  content = content.replace(
    /\b(filters|queryParams|updateParams|whereParams)\s*:\s*any\b/g,
    (_, name) => `${name}: Record<string, unknown>`
  );

  // 4) Remover Response do import { ... Response ... } from 'express' se existir
  content = content.replace(
    /^(\s*import\s*\{[^}]*?)\s*,\s*Response\s*,?([^}]*\}\s+from\s+['"]express['"];?\s*)$/m,
    (_, pre, post) => {
      const left = pre.trimEnd();
      const right = post.trimStart();
      return `${left}${right}`;
    }
  );
  // Se Response sozinho no import: import { Response } from 'express' → substituir por vazio e manter Router etc
  content = content.replace(
    /^(\s*import\s*\{)\s*Response\s*(\}\s+from\s+['"]express['"];?\s*)$/m,
    (m, g1, g2) => {
      // só deixar comentado se não houver Router
      if (!/Router|Request|NextFunction/.test(m)) {
        return `${g1}${g2}`;
      }
      return m;
    }
  );

  // 5) params: any[] → unknown[]
  content = content.replace(/\bparams\s*:\s*any\s*\[\s*\]/g, 'params: unknown[]');

  // 6) .map/.find/.forEach/.filter((x: any) → wrapper
  const wrapperPatterns = [
    ['map', 'map'], ['find', 'find'], ['filter', 'filter'],
    ['forEach', 'forEach'], ['reduce', 'reduce'], ['some', 'some'], ['every', 'every']
  ];
  for (const [fn] of wrapperPatterns) {
    // Pattern: .fn((x: any)  ou .fn((x: any,y: any) etc
    content = content.replace(
      new RegExp(`\\.${fn}\\(\\(\\s*([a-zA-Z_$][\\w$]*)\\s*:\\s*any\\s*(?:,\\s*([a-zA-Z_$][\\w$]*)\\s*:\\s*any)?\\s*\\)`, 'g'),
      (match, p1, p2) => {
        const raw1 = `${p1}Raw`;
        let header = `.${fn}((${raw1}: unknown`;
        let cast = `const ${p1} = ${raw1} as Record<string, unknown>;`;
        if (p2) {
          const raw2 = `${p2}Raw`;
          header += `, ${raw2}: unknown`;
          cast += ` const ${p2} = ${raw2} as Record<string, unknown>;`;
        }
        return `${header}) => { ${cast} return (`;
      }
    );
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { file: rel, changed: true };
  }
  return { file: rel, changed: false };
}

const results = filesWithAny.map((p) => fixFile(path.isAbsolute(p) ? p : path.resolve(p)));
const changed = results.filter((r) => r.changed).length;
console.log(`Processed ${results.length} files, changed ${changed}`);
for (const r of results) {
  if (r.changed) console.log(`  MODIFIED: ${r.file}`);
}
