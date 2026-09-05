import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const PATH = resolve(process.cwd(), 'backend/src/services/remoteCommandService.ts');
let c = readFileSync(PATH, 'utf-8');
// Fix pattern: );}\n    } catch  → );\n    } catch
c = c.replace(/(\);\})\r?\n(\s{4}\}\s*catch\s*\()/g, (m, p1, p2) => {
  const cleanSemi = p1.slice(0, -1);
  return cleanSemi + '\n' + p2;
});
// Fix pattern: cmd\}\n    } catch (cmd ends with }) – general trailing } before \n    } catch
c = c.replace(/([\w\s\"\'\)\;])\})\r?\n(\s{4}\}\s*catch\s*\()/g, (m, p1, p2) => p1 + '\n' + p2);
writeFileSync(PATH, c, 'utf-8');
// Verify
import { spawnSync } from 'node:child_process';
