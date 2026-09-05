import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const PATH = resolve(process.cwd(), 'backend/src/services/remoteCommandService.ts');
let c = readFileSync(PATH, 'utf-8');
// Find all occurrences of pattern we know: `return deleted;\n    }` then extra `\n    }`
// Limpar cleanupOldScreenshots / pruneScreenshotsPerTotem / cleanupOldCommands INTEIROS e reescrever a partir do original (HEAD) puro,
// porque o arquivo está acumulando substituições ruins.
//
// Estratégia: pegar o conteúdo de cleanupOldScreenshots / pruneScreenshotsPerTotem / cleanupOldCommands do HEAD via git show
