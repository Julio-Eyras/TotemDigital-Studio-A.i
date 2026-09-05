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

  // 1) CORREÇÃO: (var as Record<string, unknown>) quando o var é tipado → cast duplo
  // Substituir TODO `as Record<string, unknown>)` que NÃO foi precedido por `as unknown`
  // Regra: `as Record<string, unknown>)` NÃO precedido por `unknown ` → inserir `unknown as`
  src = src.replace(
    /(?<!unknown )as Record<string, unknown>/g,
    () => { edits++; return 'as unknown as Record<string, unknown>'; }
  );

  // 2) CORREÇÃO TS2741: DispatcherResponse sem propriedade `data`
  // Nos blocos { success: false, error: "...", statusCode: N, duration: N }
  // Adicionar "data: undefined," após success: false
  // Usar regex mais seguro: encontrar estes objetos e adicionar data
  src = src.replace(
    /\{\s*success:\s*false,\s*error:\s*([^,]+),\s*statusCode:\s*(\d+),\s*duration:\s*([^}]+)\s*\}/g,
    (match, err, code, dur) => {
      edits++;
      return `{ success: false, data: undefined, error: ${err}, statusCode: ${code}, duration: ${dur} }`;
    }
  );
  // Variante com fromCache também
  src = src.replace(
    /\{\s*success:\s*false,\s*error:\s*([^,]+),\s*statusCode:\s*(\d+),\s*duration:\s*([^,]+),\s*fromCache:\s*([^}]+)\s*\}/g,
    (match, err, code, dur, fc) => {
      edits++;
      return `{ success: false, data: undefined, error: ${err}, statusCode: ${code}, duration: ${dur}, fromCache: ${fc} }`;
    }
  );

  // 3) CORREÇÃO Sharp: `sharp as unknown as Record<string, unknown>` ou similares
  //    Sharp é um construtor. Se temos algo como:
  //    const sharp = (await import('sharp')).default as unknown as Record<string, unknown>;
  //    transformar de volta para manter Sharp tipo: remover o cast para Record, manter any ou tipo nativo.
  //    O padrão seguro é procurar o contexto Sharp e reverter.
  if (file === 'htmlBoardThumbnail.ts') {
    // Ler contexto e ajustar manualmente: Sharp constructor não pode ser Record.
    // Substituir `as unknown as Record<string, unknown>` por `: any` na declaração Sharp
    // (Se Sharp tem default export tipo construtor, manter any é o retrocompatível.)
    src = src.replace(
      /(sharp\s*\(\s*[^)]*\)\s*)\.setTimeout\(/g,
      // Nesta library: se tem `var as unknown as Record` não pode chamar métodos.
      // Solução: trocar a variável Sharp para `any`
      (match) => match
    );
    // Trocar a tipagem da variável sharp que foi definida como Record
    // Exemplo: `let sharp: Record<string, unknown>;` → `let sharp: any;`
    src = src.replace(
      /(const|let|var)\s+(sharp|Sharp)\s*:\s*Record<string, unknown>\s*;/g,
      (_, kw, nm) => { edits++; return `${kw} ${nm}: any;`; }
    );
    // Trocar atribuição Sharp c/ cast Record → any
    src = src.replace(
      /(sharp\s*=\s*[^;]+)as unknown as Record<string, unknown>/g,
      (_, pre) => { edits++; return `${pre}as any`; }
    );
  }

  // 4) installationModulesService.ts: `db: Record<string, unknown>` → voltar para tipo correto ou any
  //    (db é DatabaseWrapper, não pode ser Record se o código espera findFirst etc.)
  if (file === 'installationModulesService.ts') {
    // Substituir `db: Record<string, unknown>` → `db: any` (mantém retrocompatibilidade, parametro interno)
    src = src.replace(
      /\bdb\s*:\s*Record<string, unknown>/g,
      () => { edits++; return 'db: any'; }
    );
  }

  // 5) financialAdminService.ts: `billingService: unknown` → não pode ser unknown pois é class instance
  //    trocar para `billingService: any` (ou tipo exato)
  if (file === 'financialAdminService.ts') {
    src = src.replace(
      /\bbillingService\s*:\s*unknown\b/g,
      () => { edits++; return 'billingService: any'; }
    );
  }

  // 6) exportScheduleService.ts: `auditService: unknown` → instance, trocar para any
  if (file === 'exportScheduleService.ts') {
    src = src.replace(
      /\bauditService\s*:\s*unknown\b/g,
      () => { edits++; return 'auditService: any'; }
    );
  }

  // 7) campaignService.ts: instâncias CampaignService → trocar unknown → any
  if (file === 'campaignService.ts') {
    src = src.replace(
      /^(export\s+let\s+campaignServiceInstance)\s*:\s*unknown\s*;/gm,
      (_, decl) => { edits++; return `${decl}: any;`; }
    );
    src = src.replace(
      /\bcampaignServiceInstance\s*=\s*\{/g,
      // Não aplicar se já é campaignService
      (match) => match
    );
  }

  if (src !== original) {
    fs.writeFileSync(fp, src, 'utf8');
    console.log(`✅ ${file}: ${edits} correções`);
    totalEdits += edits;
    changedFiles++;
  }
}

console.log(`\n📊 TOTAL CORRECTIVO v34: ${changedFiles} arquivos | ${totalEdits} alterações`);
