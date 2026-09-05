import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('../src/__tests__', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
}
walk(ROOT);

let totalEdits = 0;
const perFile = new Map();

const PATTERNS = [
  // (req: any, res: any, next: any) / (_req: any, _res: any, next: any) etc
  {
    re: /\((_?\w*): any\s*,\s*(_?\w*): any\s*,\s*(_?\w*): any\s*\)\s*=>/g,
    rep: (_m, a, b, c) => `(${a}: express.Request, ${b}: express.Response, ${c}: express.NextFunction) =>`,
  },
  // (req: any, res: any, next: any) {   (arrow function alternative)
  {
    re: /\((_?\w*): any\s*,\s*(_?\w*): any\s*,\s*(_?\w*): any\s*\)\s*\{/g,
    rep: (_m, a, b, c) => `(${a}: express.Request, ${b}: express.Response, ${c}: express.NextFunction) {`,
  },
  // (req: any, res: any) => or {
  {
    re: /\((_?\w*): any\s*,\s*(_?\w*): any\s*\)\s*=>/g,
    rep: (_m, a, b) => `(${a}: express.Request, ${b}: express.Response) =>`,
  },
  {
    re: /\((_?\w*): any\s*,\s*(_?\w*): any\s*\)\s*\{/g,
    rep: (_m, a, b) => `(${a}: express.Request, ${b}: express.Response) {`,
  },
  // (_req: any, _res: any) next-only pairs sometimes
  // standalone next: any param (1-arg)
  {
    re: /\(next: any\)\s*=>/g,
    rep: () => `(next: express.NextFunction) =>`,
  },
  // Standalone variable declarations: const req: any = {
  {
    re: /const (req): any\s*=\s*\{/g,
    rep: (_m, name) => `const ${name}: Partial<express.Request> & Record<string, unknown> = {`,
  },
  {
    re: /const (res): any\s*=\s*\{/g,
    rep: (_m, name) => `const ${name}: Partial<express.Response> & Record<string, unknown> = {`,
  },
  {
    re: /const (e|err|error): any\s*=\s*new Error/g,
    rep: (_m, name) => `const ${name}: Error & { statusCode?: number; code?: string } = new Error`,
  },
];

const QUALIFIER_IMPORT = `\nimport * as express from 'express';\n`;

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const orig = src;

  for (const p of PATTERNS) {
    const matches = src.match(p.re);
    if (matches) {
      perFile.set(file, (perFile.get(file) || 0) + matches.length);
      totalEdits += matches.length;
    }
    src = src.replace(p.re, p.rep);
  }

  if (src !== orig && !/import\s+\*\s+as\s+express\s+from\s+['"]express['"]/.test(src)) {
    // Insert after last import
    const imports = [...src.matchAll(/^import\s+.*?;\s*$/gm)];
    if (imports.length > 0) {
      const last = imports[imports.length - 1];
      const idx = (last.index || 0) + last[0].length;
      src = src.slice(0, idx) + QUALIFIER_IMPORT + src.slice(idx);
    } else {
      src = QUALIFIER_IMPORT.trimStart() + src;
    }
  }

  if (src !== orig) writeFileSync(file, src, 'utf8');
}

console.log(`[v37] Total substitutions: ${totalEdits}`);
console.log(`[v37] Files touched: ${perFile.size}`);
for (const [f, c] of [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  - ${relative(process.cwd(), f)}: ${c} edits`);
}
