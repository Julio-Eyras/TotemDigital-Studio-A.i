import fs from 'fs';
import path from 'path';

const SRC_ROUTES = path.resolve(process.cwd(), 'backend/src/routes');
const TESTS_DIR = '__tests__';

const skipFiles = new Set([
  'installationModules.ts', 'playlists.ts', 'contracts.ts', 'players.ts',
  'users.ts', 'subscribers.ts', 'subscriptions.ts', 'billing.ts', 'totems.ts',
  'debug.ts'
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === TESTS_DIR) continue;
      walk(full, files);
    } else if (entry.name.endsWith('.ts')) {
      if (!skipFiles.has(entry.name)) files.push(full);
    }
  }
  return files;
}

const patterns = [
  { desc: 'import express from → add Request/Response',
    re: /^import (express|{ Router })(?!.*Request)(.*) from ['"](express)['"];?/gm,
    getReplacement: (match, g1) => {
      if (g1 === 'express') return `import express, { Request, Response, NextFunction } from 'express';`;
      if (g1 === '{ Router }') return `import { Router, Request, Response, NextFunction } from 'express';`;
      return match;
    }
  },
  { desc: 'import Router from express → add types',
    re: /^import \{ Router,?\s*\} from ['"](express)['"];?/gm,
    replacement: `import { Router, Request, Response, NextFunction } from 'express';`
  },
  { desc: 'async (req: any, res: any) → typed + Promise',
    re: /async \(req: any, res: any\) => \{/g,
    replacement: `async (req: Request, res: Response): Promise<Response | void> => {`
  },
  { desc: 'async (req: any, res) → typed + Promise',
    re: /async \(req: any, res\) => \{/g,
    replacement: `async (req: Request, res: Response): Promise<Response | void> => {`
  },
  { desc: 'router.VERB(..., async (req: any, res) - without then-block match inline',
    re: /, async \(req: any, res\)(?::\s*\w+\)?\s*)? =>/g,
    replacement: `, async (req: Request, res: Response) =>`
  },
  { desc: 'validateRequest/normalizeBody middlewares (req: any, res: any, next: any)',
    re: /const validateRequest = \(req: any, res: any, next: any\) => \{/g,
    replacement: `const validateRequest = (req: Request, res: Response, next: NextFunction): void => {`
  },
  { desc: 'generic const x: any = {} → Record<string, unknown>',
    re: /const (\w+): any = \{\}/g,
    replacement: `const $1: Record<string, unknown> = {}`
  },
  { desc: 'let x: any = null → Record union',
    re: /let (\w+): any = null;/g,
    replacement: `let $1: Record<string, unknown> | null = null;`
  },
  { desc: 'let x: any = null + subscriber/publisher pattern multi-var',
    re: /let (\w+): any = null;\s*let (\w+): any = null;/g,
    replacement: `let $1: Record<string, unknown> | null = null;\n    let $2: Record<string, unknown> | null = null;`
  },
  { desc: '.map((x: any) => [ / nested brackets',
    re: /\.map\(\((\w+): any\) => \[/g,
    replacement: `.map(($1Raw: unknown) => { const $1 = $1Raw as Record<string, unknown>; return [`
  },
  { desc: '.map((x: any) => ... arrow block body',
    re: /\.map\(\((\w+): any\) => \{/g,
    replacement: `.map(($1Raw: unknown) => { const $1 = $1Raw as Record<string, unknown>; {`
  },
  { desc: '.filter((x: any) =>',
    re: /\.filter\(\((\w+): any\) =>/g,
    replacement: `.filter(($1: unknown) =>`
  },
  { desc: 'function isTotemRowActive / any predicate helpers',
    re: /function (\w+)\(t: any\): boolean \{/g,
    replacement: `function $1(t: unknown): boolean { const r = t as Record<string, unknown>;`
  },
  { desc: 'fs.unlink / Node callback err: any',
    re: /\(err: any\) => \{/g,
    replacement: `(err: unknown) => {`
  },
  { desc: 'escapeCsv / helper callback val: any',
    re: /\(val: any\): string =>/g,
    replacement: `(val: unknown): string =>`
  },
  { desc: 'normalizeXxxBody custom middlewares any params',
    re: /const (\w+) = \(req: any, (\w+): any, next: any\) => \{/g,
    replacement: `const $1 = (req: Request, $2: Response, next: NextFunction) => {`
  },
  { desc: 'ensureXxxAccess funcs req:any res:any',
    re: /async function (\w+)\(req: any, res: any, /g,
    replacement: `async function $1(req: Request, res: Response, `
  },
];

const routeFiles = walk(SRC_ROUTES);
console.log(`[fix_routes_any_v22] Found ${routeFiles.length} route files to process`);

let statsFiles = 0, statsChanges = 0;
for (const file of routeFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const before = content;
  for (const p of patterns) {
    content = content.replace(p.re, (match, ...args) => {
      if (typeof p.replacement === 'string') return p.replacement.replace(/\$(\d+)/g, (_, n) => args[Number(n) - 1] ?? '');
      if (typeof p.getReplacement === 'function') return p.getReplacement(match, ...args);
      return match;
    });
  }
  if (content !== before) {
    fs.writeFileSync(file, content, 'utf8');
    statsFiles++;
    const diff = before.length - content.length; // crude metric
    statsChanges++;
    console.log(`  [OK] ${path.basename(file)}`);
  }
}

console.log(`[fix_routes_any_v22] Done. ${statsFiles} files modified.`);
