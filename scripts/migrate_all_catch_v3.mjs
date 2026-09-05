/**
 * migrate_all_catch_v3.mjs — SPRINT 6 Fase 3
 *
 * Expansão do script v2 para workers, middlewares e todas as rotas restantes
 * com TOP volumes de catch(error:any).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const CWD = process.cwd();

const TARGETS = [
  // Workers (BullMQ, cron-heavy)
  'backend/src/workers/playlistEngineWorker.ts',
  'backend/src/workers/playlistMixWorker.ts',
  'backend/src/workers/advancedScheduleWorker.ts',
  'backend/src/workers/financialBillingWorker.ts',
  'backend/src/workers/exportWorker.ts',
  'backend/src/workers/subscriberAccessNotificationWorker.ts',
  'backend/src/workers/invoiceWorker.ts',
  'backend/src/workers/exportFormats.ts',

  // Middlewares
  'backend/src/middleware/auth.middleware.ts',
  'backend/src/middleware/flagAuth.middleware.ts',
  'backend/src/middleware/moduleAuth.middleware.ts',
  'backend/src/middleware/subscriberIsolation.middleware.ts',
  'backend/src/middleware/subscriberParamAccess.middleware.ts',

  // Rotas TOP (>=10 blocos cada)
  'backend/src/routes/reports.ts',
  'backend/src/routes/settings.ts',
  'backend/src/routes/campaigns.ts',
  'backend/src/routes/smart-playlist.ts',
  'backend/src/routes/contracts.ts',
  'backend/src/routes/qrcodes.ts',
  'backend/src/routes/installationModules.ts',
  'backend/src/routes/media.ts',
  'backend/src/routes/billing.ts',
  'backend/src/routes/analytics.ts',

  // Rotas médias (5-9 blocos)
  'backend/src/routes/ai.ts',
  'backend/src/routes/smart-tvs.ts',
  'backend/src/routes/locals.ts',
  'backend/src/routes/playlists.ts',
  'backend/src/routes/publishers.ts',
  'backend/src/routes/roles.ts',
  'backend/src/routes/permissions.ts',
  'backend/src/routes/financial-admin.ts',
  'backend/src/routes/subscriber-access.ts',
  'backend/src/routes/advanced-schedules.ts',
  'backend/src/routes/export-schedules.ts',
  'backend/src/routes/export-queries.ts',
  'backend/src/routes/ota-updates.ts',
  'backend/src/routes/smartdisplayfx.ts',
  'backend/src/routes/smartdisplayfx-timelines.ts',
  'backend/src/routes/smartdisplayfx-sites.ts',
  'backend/src/routes/smartdisplayfx-effects.ts',
  'backend/src/routes/smartdisplayfx-rules.ts',
  'backend/src/routes/smartdisplayfx-analytics.ts',
  'backend/src/routes/smartdisplayfx-telemetry.ts',
  'backend/src/routes/dispatcher-totem.ts',
  'backend/src/routes/dispatcher-debug.ts',
  'backend/src/routes/plans.ts',
  'backend/src/routes/financial-pix-webhook.ts',
  'backend/src/routes/dashboard.ts',
  'backend/src/routes/menu-catalog.ts',
  'backend/src/routes/player.ts',
  'backend/src/routes/players.ts',
  'backend/src/routes/publish-board.ts',
  'backend/src/routes/publish-board-public.ts',
  'backend/src/routes/publish-templates.ts',
  'backend/src/routes/quick-publish.ts',
  'backend/src/routes/simple-publish.ts',
  'backend/src/routes/lab-tdep.ts',
  'backend/src/routes/lab-system.ts',
  'backend/src/routes/lab-ace.ts',
  'backend/src/routes/tags.ts',
  'backend/src/routes/alerts.ts',
  'backend/src/routes/backups.ts',
  'backend/src/routes/network.ts',
  'backend/src/routes/notifications.ts',
  'backend/src/routes/player-apk.ts',
  'backend/src/routes/player-debug.ts',
  'backend/src/routes/logs.ts',
  'backend/src/routes/email.ts',
  'backend/src/routes/publisher-billing.ts',
  'backend/src/routes/subscriber-billing.ts',
  'backend/src/routes/playlist-engine.ts',
  'backend/src/routes/playlist-mix.ts',
  'backend/src/routes/dashboard-layouts.ts',
  'backend/src/routes/facial-recognition.ts',
  'backend/src/routes/clients.ts',
  'backend/src/routes/billing-control.ts',
  'backend/src/routes/export-executions.ts',
  'backend/src/routes/health.ts',
  'backend/src/routes/debug.ts',

  // Outros services (volumes menores)
  'backend/src/services/whatsappMessagingService.ts',
  'backend/src/services/websocketService.ts',
  'backend/src/services/webhookService.ts',
  'backend/src/services/eventLogService.ts',
  'backend/src/services/emailService.ts',
  'backend/src/services/otaHeartbeatHelper.ts',
  'backend/src/services/totemPlaylistMixService.ts',
  'backend/src/services/campaignEligibilityService.ts',

  // Helpers
  'backend/src/utils/subscriberHelper.ts',

  // Startup
  'backend/src/startup/operationalWorkersLifecycle.ts',
];

const NORMALIZE_LINE = 'const e = normalizeError(error);';
const CATCH_REGEX = /(\s*)\}\s*catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\n([\s\S]*?\n)\s*\}/g;

function toAbs(p) {
  return resolve(join(CWD, p));
}

function replaceRefs(body) {
  let r = body.replace(/\berror\?\.message\b/g, 'e.message');
  r = r.replace(/\berror\.message\b/g, 'e.message');
  r = r.replace(/\berror\.code\b/g, 'e.code');
  r = r.replace(/\berror\.stack\b/g, 'e.error.stack');
  r = r.replace(/\berror\.name\b/g, 'e.error.name');
  r = r.replace(
    /(logError|logWarn|logInfo|console\.log|console\.error|console\.warn)\(([^\n]*?),\s*error\s*\)/g,
    (_m, fn, args) => `${fn}(${args}, e.error)`
  );
  r = r.replace(
    /(logError|logWarn|logInfo)\(([^\n]*?),\s*error\s*,\s*\{/g,
    (_m, fn, args) => `${fn}(${args}, e.error, {`
  );
  r = r.replace(/\bthrow\s+error\s*;/g, 'throw e.error;');
  r = r.replace(/\bnext\(\s*error\s*\)/g, 'next(e.error);');
  r = r.replace(/\bisDatabaseError\(\s*error\s*\)/g, 'isDatabaseError(e.raw)');
  r = r.replace(/\bisUniqueViolationError\(\s*error\s*\)/g, 'isUniqueViolationError(e.raw)');
  // if (error) → if (e.error)  -- pattern raro mas existe
  r = r.replace(/\bif\s*\(\s*error\s*\)/g, 'if (e.error)');
  return r;
}

function detectDangerous(body) {
  const badProp = /\berror\.(?!message|code|stack|name|constructor)(\w+)\b/.test(body);
  const errorEq = /\berror\s*[!=]==?/.test(body);
  const errorSpread = /\.\.\.\s*error\b/.test(body);
  const errorAs = /\bas\s+error\b/i.test(body);
  return badProp || errorEq || errorSpread || errorAs;
}

function ensureImport(content, filePath) {
  if (content.includes("from '../utils/errors'") || content.includes('from "./errors"')) {
    return content;
  }
  const fileDir = dirname(filePath);
  const errorsAbs = resolve(fileDir, '../utils/errors');
  let rel = relative(fileDir, errorsAbs).replace(/\\/g, '/').replace(/\.ts$/, '');
  if (!rel.startsWith('.') && !rel.startsWith('/')) rel = './' + rel;
  const importLine = `import { normalizeError } from '${rel}';\n`;
  const importLines = content.match(/^import .+;$/gm) || [];
  if (importLines.length === 0) {
    return importLine + content;
  }
  const lastImport = importLines[importLines.length - 1];
  return content.replace(lastImport, lastImport + '\n' + importLine.replace(/\n$/, ''));
}

function processFile(filePath, rel) {
  if (!existsSync(filePath)) {
    return { replaced: 0, skipped: [] };
  }
  const original = readFileSync(filePath, 'utf8');
  let content = original;
  const skipped = [];
  let replaced = 0;
  content = content.replace(CATCH_REGEX, (match, closeIndent, body) => {
    if (detectDangerous(body)) {
      const line = (original.slice(0, original.indexOf(match)).match(/\n/g) || []).length + 1;
      skipped.push({ line });
      return match;
    }
    const safeBody = replaceRefs(body);
    replaced += 1;
    const ind = closeIndent.replace(/^[\r\n]+/, '');
    const bodyLines = body.split('\n');
    const firstBody = bodyLines.find((l) => l.trim().length > 0) || bodyLines[0] || '';
    const m2 = firstBody.match(/^(\s*)/);
    const bodyIndent = m2 ? m2[1] : ind + '  ';
    return `${ind}} catch (error: unknown) {\n${bodyIndent}${NORMALIZE_LINE}\n${safeBody}${ind}}`;
  });
  if (replaced > 0) {
    content = ensureImport(content, filePath);
  }
  if (replaced > 0 || skipped.length > 0) {
    writeFileSync(filePath, content, 'utf8');
  }
  return { replaced, skipped };
}

const summary = { files: 0, replaced: 0, skippedBlocks: [] };
for (const rel of TARGETS) {
  const abs = toAbs(rel);
  const r = processFile(abs, rel);
  summary.files += r.replaced + r.skipped.length > 0 ? 1 : 0;
  summary.replaced += r.replaced;
  summary.skippedBlocks.push(...r.skipped.map((s) => ({ file: rel, ...s })));
  if (r.replaced > 0 || r.skipped.length > 0) {
    console.log(`[${rel}] ${r.replaced} bloco(s); ${r.skipped.length} perigoso(s)`);
  }
}
console.log('\n===== RESUMO SPRINT 6 FASE 3 =====');
console.log(`Total de blocos substituídos: ${summary.replaced}`);
console.log(`Arquivos processados: ${summary.files}`);
if (summary.skippedBlocks.length > 0) {
  console.log(`\nBlocos NÃO substituídos (revisar manualmente):`);
  for (const s of summary.skippedBlocks) console.log(`  - ${s.file} ~linha ${s.line}`);
} else {
  console.log('Nenhum bloco perigoso.');
}
