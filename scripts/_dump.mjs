import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const PATH = resolve(process.cwd(), 'backend/src/services/remoteCommandService.ts');
let c = readFileSync(PATH, 'utf-8');
console.log('Length:', c.length);
console.log('L465-470 raw chars:', [...c.slice(c.indexOf('  /**\n   * Mantém no máximo'), c.indexOf('  /**\n   * Mantém no máximo') + 400)].join(''));
