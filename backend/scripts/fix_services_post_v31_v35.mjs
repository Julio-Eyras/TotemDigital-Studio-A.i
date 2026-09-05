import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SERVICES = path.join(ROOT, 'src', 'services');

let totalEdits = 0;
let changedFiles = 0;

const files = readdirSync(SERVICES).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const fp = path.join(SERVICES, file);
  let src = fs.readFileSync(fp, 'utf8');
  const original = src;
  let edits = 0;

  // =======================================================
  // GRUPO 1 (G1): Campos de singletons Services que foram trocados para
  // 'unknown' ou 'Record<string, unknown>' mas devem ser class instances.
  // Ex: `auditService: Record<string, unknown>` → `auditService: any`
  // =======================================================
  const serviceNames = [
    'AuditService','StorageService','SettingsService',
    'SubscriberBillingService','PublisherBillingService',
    'CampaignService','BillingService','PermissionService',
    'MediaService','TotemService','PlaylistService',
    'RoleService','SubscriptionService','PublisherService',
    'ContractService','AlertService','QrCodeService',
    'SubscriberService','UserService','FinancialAdminService',
    'AuthService','LocalService','Database'
  ];
  for (const svc of serviceNames) {
    const re = new RegExp(`\\b([a-zA-Z_$][\\w$]*Service|auditService|billingService|storageService|settingsService|database|db)\\s*:\\s*(unknown|Record<string, unknown>)\\b`, 'g');
    const matches = src.match(re);
    if (matches) {
      src = src.replace(re, (full, name, type) => {
        // Não substituir parâmetros `db` em installationModules (já foi corrigido antes) - OK qualquer case
        edits++;
        return `${name}: any`;
      });
    }
  }

  // =======================================================
  // GRUPO 2 (G2): Casts para Record<string, unknown> usados como CALLABLE (função)
  // Padrão: `(var as unknown as Record<string, unknown>)(` → deve ser `(var as any)(`
  // Também: `(var as Record<string, unknown>)(` → `(var as any)(`
  // =======================================================
  src = src.replace(
    /\(([a-zA-Z_$][\w$.]*)\s+as\s+unknown\s+as\s+Record<string, unknown>\)\s*\(/g,
    (_, vname) => { edits++; return `(${vname} as any)(`; }
  );
  src = src.replace(
    /\(([a-zA-Z_$][\w$.]*)\s+as\s+Record<string, unknown>\)\s*\(/g,
    (_, vname) => { edits++; return `(${vname} as any)(`; }
  );

  // =======================================================
  // GRUPO 3 (G3): DispatcherResponse - campos 'data: undefined' que causam
  // TS2322: Type 'undefined' is not assignable to type 'Record<string, unknown>'
  // Solução: trocar data: undefined → data: {} nesses objetos
  // =======================================================
  if (file === 'dispatcherRouter.ts') {
    src = src.replace(
      /(\{\s*success:\s*false,\s*)data:\s*undefined(,\s*error:[^,]+,\s*statusCode:\s*\d+,\s*duration:[^}]+\})/g,
      (_, pre, post) => { edits++; return `${pre}data: {}${post}`; }
    );
    src = src.replace(
      /(\{\s*success:\s*false,\s*)data:\s*undefined(,\s*error:[^,]+,\s*statusCode:\s*\d+,\s*duration:[^,]+,\s*fromCache:\s*(?:true|false|undefined)\s*\})/g,
      (_, pre, post) => { edits++; return `${pre}data: {}${post}`; }
    );
  }

  // =======================================================
  // GRUPO 4 (G4): mediaService path like - retornos Record acessados sem narrowing.
  // `var as unknown as Record<string, unknown>` quando acessado para path, retorna {}
  // Solução mais ampla: se a expressão é usada como PathLike (string), trocar cast final para any
  // Por enquanto: trocar todos os `(xxxPath as unknown as Record<string, unknown>)` → `as any` em mediaService
  // =======================================================
  if (file === 'mediaService.ts') {
    // Trocar casts Record quando a variável é path/file
    src = src.replace(
      /\(\s*(filePath|mediaPath|srcPath|destPath|dirPath|baseDir|fullPath|storagePath|thumbPath|inputPath|outputPath|tempDir|cachePath)\s+as\s+unknown\s+as\s+Record<string, unknown>\s*\)/g,
      (_, pname) => { edits++; return `(${pname} as any)`; }
    );
    // Também casts variados de path que retornam {} como PathLike
    src = src.replace(
      /\(\s*(filePath|mediaPath|srcPath|destPath|dirPath|baseDir|fullPath|storagePath|thumbPath|inputPath|outputPath|tempDir|cachePath|downloadedFilePath|storedFileName|storedPath)\s+as\s+Record<string, unknown>\s*\)/g,
      (_, pname) => { edits++; return `(${pname} as any)`; }
    );
  }

  // =======================================================
  // GRUPO 5 (G5): htmlBoardThumbnail Sharp - qualquer cast Record de Sharp → any
  // =======================================================
  if (file === 'htmlBoardThumbnail.ts') {
    src = src.replace(
      /\(\s*(?:sharp|Sharp)\s+as\s+(?:unknown\s+as\s+)?Record<string, unknown>\s*\)/g,
      () => { edits++; return '(sharp as any)'; }
    );
  }

  if (src !== original) {
    fs.writeFileSync(fp, src, 'utf8');
    console.log(`✅ ${file}: ${edits} correções G1-G5`);
    totalEdits += edits;
    changedFiles++;
  }
}

console.log(`\n📊 TOTAL CORRECTIVO v35: ${changedFiles} arquivos | ${totalEdits} alterações`);
