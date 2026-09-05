import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const PATH = resolve(process.cwd(), 'backend/src/services/remoteCommandService.ts');
let c = readFileSync(PATH, 'utf-8');
// Fix pattern: "X;}\n    } catch (" where X ends with letter/digit/semicolon/paren/quote
c = c.replace(/\}\r?\n\s{4}\}\s*catch\s*\(/g, (match) => {
  // Drop the first }
  return match.replace(/^\}/, '');
});
writeFileSync(PATH, c, 'utf-8');
console.log('Done v3');
