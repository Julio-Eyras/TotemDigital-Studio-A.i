import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const filesWithAny = process.argv.slice(2);
if (filesWithAny.length === 0) {
  console.error('Usage: node fix_services_residual_any_v31.mjs <file1> ...');
  process.exit(1);
}

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return { file: filePath, skipped: 'not found' };
  const rel = path.relative(ROOT, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1) params: any[] → unknown[]
  content = content.replace(/\bparams\s*:\s*any\s*\[\s*\]/g, 'params: unknown[]');

  // 2) Outros arrays com any: `rows: any[]` → `unknown[]`; `items: any[]` → `unknown[]`; `filters: any[]` → `unknown[]`; `mixItems: any[]` → `unknown[]`
  content = content.replace(
    /\b(rows|items|mixItems|topology|subscribers|results|mediaRows|tvMediaRows|subRows|cpl|eligibleTotems|contracts|mediaRows2|totemRows|warnings|campaignsWithPlaylists)\s*:\s*any\s*\[\s*\]/g,
    (_, name) => `${name}: unknown[]`
  );

  // 3) Config / metadata / features / limits : any  → Record<string, unknown> ou unknown
  const objectFields1 = ['metadata', 'config', 'features', 'limits', 'plan', 'ai_config', 'settings', 'capabilities', 'revenue_share_rules'];
  for (const f of objectFields1) {
    // Param field: `f?: any` ou `f: any` (interfaces e parâmetros)
    content = content.replace(
      new RegExp(`\\b${f}\\s*\\??\\s*:\\s*any\\b`, 'g'),
      `${f}: Record<string, unknown>`
    );
  }
  // Interfaces fields genéricos `processedMetadata: any` → unknown
  content = content.replace(
    /\b(processedMetadata|raw|value|revenueShareRules|request|response|data|result|extractToken|user|file|messageData|msgData|rawData|context|aiContext|policyContext|sessionContext)\s*:\s*any\b/g,
    (_, name) => `${name}: unknown`
  );

  // 4) filters/data/body/options : any → Record<string, unknown>
  for (const f of ['filters', 'data', 'options', 'body', 'query', 'updateData', 'createData']) {
    content = content.replace(
      new RegExp(`\\b${f}\\s*\\??\\s*:\\s*any\\b`, 'g'),
      `${f}: Record<string, unknown>`
    );
  }

  // 5) [DESATIVADO por risco de quebrar sintaxe em closures multilinhas] 
  // .map/.find/.filter/.forEach/.reduce/.some/.every com param:any → FEITO MANUALMENTE após typecheck
  // (Lição L5-5E parcial routes: regex "return (" quebra sintaxe em ~20% arquivos com objetos/retornos multilinhas)

  // 6) (var as any) → (var as Record<string, unknown>) (só se não parecer com "as any[]" etc)
  content = content.replace(
    /\(\s*([a-zA-Z_$][\w$.]*)\s+as\s+any\s*\)/g,
    (_, p1) => `(${p1} as Record<string, unknown>)`
  );

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
