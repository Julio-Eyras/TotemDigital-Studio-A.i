import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const path = resolve(process.cwd(), 'backend/src/services/remoteCommandService.ts');
let c = readFileSync(path, 'utf-8');
const re = /;\r?\n\s{6}\}\r?\n\s{4}\}(\s*catch\s*\()/g;
c = c.replace(re, (match, p1) => `;\n    }${p1}`);
writeFileSync(path, c, 'utf-8');
const m = [...c.matchAll(/;\r?\n\s{6}\}\r?\n\s{4}\}(\s*catch\s*\()/g)];
console.log('pattern matches remaining:', m.length);
