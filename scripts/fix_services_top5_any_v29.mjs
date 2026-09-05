import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');

const files = [
  'backend/src/services/reportsService.ts',
  'backend/src/services/totemService.ts',
  'backend/src/services/settingsService.ts',
  'backend/src/services/planService.ts',
  'backend/src/services/subscriptionService.ts',
];

let totalModified = 0;

function processFile(relPath, processFn) {
  const f = resolve(ROOT, relPath);
  let src = readFileSync(f, 'utf8');
  const original = src;
  src = processFn(src);
  if (src !== original) {
    writeFileSync(f, src, 'utf8');
    console.log(`  [v29] Modified: ${relPath}`);
    totalModified++;
  } else {
    console.log(`  [v29] No changes: ${relPath}`);
  }
}

// ============== reportsService.ts (34 anys) ==============
processFile(files[0], (src) => {
  // filters: any → filters: Record<string, unknown>
  src = src.replace(/(\s)filters:\s*any(;|,)/g, '$1filters: Record<string, unknown>$2');
  // aiAnalysis?: any → aiAnalysis?: unknown
  src = src.replace(/aiAnalysis\?:\s*any/g, 'aiAnalysis?: unknown');
  // template: any → template: Record<string, unknown>
  src = src.replace(/(\s)template:\s*any(;|,)/g, '$1template: Record<string, unknown>$2');
  // templateConfig: any → templateConfig: Record<string, unknown>
  src = src.replace(/templateConfig:\s*any/g, 'templateConfig: Record<string, unknown>');
  // params: any[] → params: unknown[]
  src = src.replace(/params:\s*any\[\]/g, 'params: unknown[]');
  // let data: any = {} → let data: Record<string, unknown> = {}
  src = src.replace(/let\s+data:\s*any\s*=\s*\{\}/g, 'let data: Record<string, unknown> = {}');
  // generate*ReportData(filters: any): Promise<any>
  src = src.replace(/(generate\w+ReportData)\(filters:\s*any\):\s*Promise<any>/g,
    '$1(filters: Record<string, unknown>): Promise<Record<string, unknown>>');
  // generate*ReportData(filters: any) sem retorno explícito Promise<any> (caso só params)
  src = src.replace(/(generate\w+ReportData)\(filters:\s*any\)/g,
    '$1(filters: Record<string, unknown>)');
  // .map((log: any) → wrapper Record
  src = src.replace(/\.map\(\(log:\s*any\)\s*=>/g, '.map((logRaw: unknown) => { const log = logRaw as Record<string, unknown>; return (');
  src = src.replace(/(\.map\(\(logRaw: unknown\) => \{ const log = logRaw as Record<string, unknown>; return \([\s\S]*?)\)\);/g, '$1)});');
  // .map((session: any) → wrapper Record
  src = src.replace(/\.map\(\(session:\s*any\)\s*=>/g, '.map((sessionRaw: unknown) => { const session = sessionRaw as Record<string, unknown>; return (');
  src = src.replace(/(\.map\(\(sessionRaw: unknown\) => \{ const session = sessionRaw as Record<string, unknown>; return \([\s\S]*?)\)\);/g, '$1)});');
  // generateReportFile(reportData: any → Record
  src = src.replace(/generateReportFile\(reportData:\s*any,/g, 'generateReportFile(reportData: Record<string, unknown>,');
  src = src.replace(/generateReportFile\(reportData:\s*any\s*\)/g, 'generateReportFile(reportData: Record<string, unknown>)');
  // convertToCSV(data: any) → Record
  src = src.replace(/convertToCSV\(data:\s*any\)/g, 'convertToCSV(data: Record<string, unknown>)');
  // .map((row: any) → wrapper Record (multi-line, não use wrapper por simplicidade)
  src = src.replace(/\.map\(\(row:\s*any\)\s*=>/g, '.map((rowRaw: unknown) => { const row = rowRaw as Record<string, unknown>; return (');
  // Fechar wrappers row
  src = src.replace(/(\.map\(\(rowRaw: unknown\) => \{ const row = rowRaw as Record<string, unknown>; return \([\s\S]*?)\)\);/g, '$1)});');
  // convertToExcel(data: any → Record
  src = src.replace(/convertToExcel\(data:\s*any,/g, 'convertToExcel(data: Record<string, unknown>,');
  // worksheet.columns.forEach((column: any) → Record
  src = src.replace(/forEach\(\(column:\s*any\)\s*=>/g, 'forEach((columnRaw: unknown) => { const column = columnRaw as Record<string, unknown>;');
  // column.eachCell(..., (cell: any) → Record
  src = src.replace(/eachCell\(\{ includeEmpty: true \},\s*\(cell:\s*any\)\s*=>/g, 'eachCell({ includeEmpty: true }, (cellRaw: unknown) => { const cell = cellRaw as Record<string, unknown>;');
  // worksheet.eachRow((row: any) → Record
  src = src.replace(/eachRow\(\(row:\s*any\)\s*=>/g, 'eachRow((rowRaw: unknown) => { const row = rowRaw as Record<string, unknown>;');
  // row.eachCell((cell: any) → Record
  src = src.replace(/eachCell\(\(cell:\s*any\)\s*=>/g, 'eachCell((cellRaw: unknown) => { const cell = cellRaw as Record<string, unknown>;');
  // Fechar cada callback eachCell com um } (apenas adicionar '}' antes de ); se linha segue padrão eachCell...
  // Nota: estes são complicados multi-line, vamos deixar como cast inline em vez de wrapper
  // Reverter e fazer de forma mais simples: apenas cast param
  // (A abordagem de wrapper é complexa para multi-line callbacks; fazer inline cast)
  // → Reverter as substituições de forEach/eachCell/eachRow acima e fazer versão inline
  src = src.replace(/forEach\(\(columnRaw: unknown\) => \{ const column = columnRaw as Record<string, unknown>;/g,
    'forEach((column_: unknown) => { const column = column_ as Record<string, unknown>;');
  src = src.replace(/eachCell\(\{ includeEmpty: true \}, \(cellRaw: unknown\) => \{ const cell = cellRaw as Record<string, unknown>;/g,
    'eachCell({ includeEmpty: true }, (cell_: unknown) => { const cell = cell_ as Record<string, unknown>;');
  src = src.replace(/eachRow\(\(rowRaw: unknown\) => \{ const row = rowRaw as Record<string, unknown>;/g,
    'eachRow((row_: unknown) => { const row = row_ as Record<string, unknown>;');
  src = src.replace(/eachCell\(\(cellRaw: unknown\) => \{ const cell = cellRaw as Record<string, unknown>;/g,
    'eachCell((cell_: unknown) => { const cell = cell_ as Record<string, unknown>;');

  // convertToPDF(data: any → Record
  src = src.replace(/convertToPDF\(data:\s*any,/g, 'convertToPDF(data: Record<string, unknown>,');
  // generateAIAnalysis(reportData: any, request: ReportRequest): Promise<any>
  src = src.replace(/generateAIAnalysis\(reportData:\s*any,\s*request:\s*ReportRequest\):\s*Promise<any>/g,
    'generateAIAnalysis(reportData: Record<string, unknown>, request: ReportRequest): Promise<Record<string, unknown>>');
  // countRecords(data: any) → Record
  src = src.replace(/countRecords\(data:\s*any\)/g, 'countRecords(data: Record<string, unknown>)');
  return src;
});

// ============== totemService.ts (21 anys) ==============
processFile(files[1], (src) => {
  // config?: any (4x) → Record<string, unknown>
  src = src.replace(/config\?:\s*any/g, 'config?: Record<string, unknown>');
  // pedestrian_demographics?: any → unknown | Record
  src = src.replace(/pedestrian_demographics\?:\s*any/g, 'pedestrian_demographics?: unknown');
  // weather_context?: any
  src = src.replace(/weather_context\?:\s*any/g, 'weather_context?: unknown');
  // event_context?: any
  src = src.replace(/event_context\?:\s*any/g, 'event_context?: unknown');
  // performance_metrics?: any
  src = src.replace(/performance_metrics\?:\s*any/g, 'performance_metrics?: unknown');
  // private normalizeTotemObject(t: any): any
  src = src.replace(/normalizeTotemObject\(t:\s*any\):\s*any/g,
    'normalizeTotemObject(t: Record<string, unknown>): Record<string, unknown>');
  // params: any[] (3x)
  src = src.replace(/params:\s*any\[\]/g, 'params: unknown[]');
  // .map((tt: any) => this.normalizeTotemObject → wrapper Record
  src = src.replace(/\.map\(\(tt:\s*any\)\s*=>/g, '.map((ttRaw: unknown) => { const tt = ttRaw as Record<string, unknown>; return (');
  src = src.replace(/(\.map\(\(ttRaw: unknown\) => \{ const tt = ttRaw as Record<string, unknown>; return \([\s\S]*?)\)\);/g, '$1)});');
  // Simple one line tt case:
  src = src.replace(/\.map\(\(tt:\s*any\)\s*=>\s*this\.normalizeTotemObject\(tt\)\);?/g,
    '.map((ttRaw: unknown) => this.normalizeTotemObject(ttRaw as Record<string, unknown>));');
  // .catch((error: any) → isto é catch block, Sprint 6 devia ter pego! Corrigir.
  src = src.replace(/\.catch\(\(error:\s*any\)\s*=>/g, '.catch((error: unknown) => { const e = error as Record<string, unknown>;');
  // saveTotemMetrics(metrics: any) → Record
  src = src.replace(/saveTotemMetrics\(totemId:\s*number,\s*metrics:\s*any\)/g,
    'saveTotemMetrics(totemId: number, metrics: Record<string, unknown>)');
  // registerHeartbeat(heartbeatData: any): Promise<any>
  src = src.replace(/registerHeartbeat\(totemId:\s*number,\s*heartbeatData:\s*any\):\s*Promise<any>/g,
    'registerHeartbeat(totemId: number, heartbeatData: Record<string, unknown>): Promise<Record<string, unknown>>');
  // getHeartbeatHistory(filters: any): Promise<any[]>
  src = src.replace(/getHeartbeatHistory\(totemId:\s*number,\s*filters:\s*any\):\s*Promise<any\[\]>/g,
    'getHeartbeatHistory(totemId: number, filters: Record<string, unknown>): Promise<Record<string, unknown>[]>');
  // .map((item: any, index: number) → wrapper Record (inline cast)
  src = src.replace(/\.map\(\(item:\s*any,\s*index:\s*number\)/g,
    '.map((itemRaw: unknown, index: number) => { const item = itemRaw as Record<string, unknown>;');
  // getTotemAnalytics(filters: any): Promise<any>
  src = src.replace(/getTotemAnalytics\(totemId:\s*number,\s*filters:\s*any\):\s*Promise<any>/g,
    'getTotemAnalytics(totemId: number, filters: Record<string, unknown>): Promise<Record<string, unknown>>');
  return src;
});

// ============== settingsService.ts (15 anys) ==============
processFile(files[2], (src) => {
  // options?: any[] → unknown[]
  src = src.replace(/options\?:\s*any\[\]/g, 'options?: unknown[]');
  // { [key: string]: any } → Record<string, unknown>
  src = src.replace(/\{\s*\[key:\s*string\]:\s*any\s*\}/g, 'Record<string, unknown>');
  // value: any → unknown (em interfaces: value: any;)
  src = src.replace(/(\s)value:\s*any(;|,)/g, '$1value: unknown$2');
  // tryParseJson(...): any → unknown
  src = src.replace(/tryParseJson\([^)]*\):\s*any/g, (match) => match.replace(/:\s*any$/, ': unknown'));
  // convertSettingValue(...): any → unknown
  src = src.replace(/convertSettingValue\([^)]*\):\s*any/g, (match) => match.replace(/:\s*any$/, ': unknown'));
  // convertValueToString(value: any → unknown
  src = src.replace(/convertValueToString\(value:\s*any,/g, 'convertValueToString(value: unknown,');
  // validateValueType(value: any → unknown
  src = src.replace(/validateValueType\(value:\s*any,/g, 'validateValueType(value: unknown,');
  // validateValue(value: any → unknown
  src = src.replace(/validateValue\(value:\s*any,/g, 'validateValue(value: unknown,');
  // Interface com [key: string]: any → substituir último any restante
  src = src.replace(/\[key:\s*string\]:\s*any/g, '[key: string]: unknown');
  return src;
});

// ============== planService.ts (13 anys) ==============
processFile(files[3], (src) => {
  // features: any / features?: any → Record
  src = src.replace(/features\??:\s*any/g, 'features$1: Record<string, unknown>'.replace('$1', ''));
  src = src.replace(/features:\s*any/g, 'features: Record<string, unknown>');
  src = src.replace(/features\?:\s*any/g, 'features?: Record<string, unknown>');
  // limits: any / limits?: any → Record
  src = src.replace(/limits:\s*any/g, 'limits: Record<string, unknown>');
  src = src.replace(/limits\?:\s*any/g, 'limits?: Record<string, unknown>');
  // params: any[] → unknown[]
  src = src.replace(/params:\s*any\[\]/g, 'params: unknown[]');
  // locals: any[], totems: any[], smartTvs: any[]
  src = src.replace(/locals:\s*any\[\]/g, 'locals: Record<string, unknown>[]');
  src = src.replace(/totems:\s*any\[\]/g, 'totems: Record<string, unknown>[]');
  src = src.replace(/smartTvs:\s*any\[\]/g, 'smartTvs: Record<string, unknown>[]');
  return src;
});

// ============== subscriptionService.ts (12 anys) ==============
processFile(files[4], (src) => {
  // metadata: any → Record
  src = src.replace(/metadata:\s*any/g, 'metadata: Record<string, unknown>');
  // plan?: any → Record
  src = src.replace(/plan\?:\s*any/g, 'plan?: Record<string, unknown>');
  // publisher?: any → Record
  src = src.replace(/publisher\?:\s*any/g, 'publisher?: Record<string, unknown>');
  // client?: any (DEPRECADO) → Record
  src = src.replace(/client\?:\s*any/g, 'client?: Record<string, unknown>');
  // params: any[] → unknown[]
  src = src.replace(/params:\s*any\[\]/g, 'params: unknown[]');
  // .map(async (sub: any) → wrapper
  src = src.replace(/\.map\(async \(sub:\s*any\)/g, '.map(async (subRaw: unknown) => { const sub = subRaw as Record<string, unknown>;');
  // processStripeWebhook(event: any) → Stripe genérico, usar unknown
  src = src.replace(/processStripeWebhook\(event:\s*any\)/g, 'processStripeWebhook(event: Record<string, unknown>)');
  // syncSubscriptionFromStripe(stripeSubscription: any) → Record
  src = src.replace(/syncSubscriptionFromStripe\(stripeSubscription:\s*any\)/g,
    'syncSubscriptionFromStripe(stripeSubscription: Record<string, unknown>)');
  // handleSubscriptionDeleted(stripeSubscription: any) → Record
  src = src.replace(/handleSubscriptionDeleted\(stripeSubscription:\s*any\)/g,
    'handleSubscriptionDeleted(stripeSubscription: Record<string, unknown>)');
  // handleInvoicePaid(invoice: any) → Record
  src = src.replace(/handleInvoicePaid\(invoice:\s*any\)/g, 'handleInvoicePaid(invoice: Record<string, unknown>)');
  // handleInvoicePaymentFailed(invoice: any) → Record
  src = src.replace(/handleInvoicePaymentFailed\(invoice:\s*any\)/g, 'handleInvoicePaymentFailed(invoice: Record<string, unknown>)');
  return src;
});

console.log(`\n[v29] DONE: ${totalModified} files modified out of ${files.length}`);
