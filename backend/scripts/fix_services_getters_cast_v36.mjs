import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICES = path.join(__dirname, '..', 'src', 'services');

const files = readdirSync(SERVICES).filter(f => f.endsWith('.ts'));
let changed = 0;
let total = 0;

for (const f of files) {
  const fp = path.join(SERVICES, f);
  let src = fs.readFileSync(fp, 'utf8');
  const orig = src;

  // Padrão: return (global as unknown as Record<string, unknown>).serviceInstanceName;
  // → adicionar cast final "as ServiceType" baseado no nome da função getXService()
  // Estratégia: encontrar linhas `return (global ...).XXXInstance;` dentro de funções
  // `getYYY() { ... }` e extrair o tipo do retorno da função.

  src = src.replace(
    /(function|get)\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*:\s*([A-Za-z_][\w<>]*)\s*\{[\s\S]*?return\s*\(\s*global\s+as\s+unknown\s+as\s+Record<string, unknown>\s*\)\.([A-Za-z_][\w$]*)\s*;/g,
    (match, kw, fname, retType, instName) => {
      // Verificar se esta linha final já tem "as ..."
      const lastLine = match.split('\n').pop() || '';
      if (lastLine.includes(' as ')) return match;
      // Trocar apenas a linha do return
      const replacement = match.replace(
        /return\s*\(\s*global\s+as\s+unknown\s+as\s+Record<string, unknown>\s*\)\.([A-Za-z_][\w$]*)\s*;$/,
        (_, prop) => `return (global as unknown as Record<string, unknown>).${prop} as ${retType};`
      );
      if (replacement !== match) total++;
      return replacement;
    }
  );

  // Segundo padrão (fallback): para os casos que regex complexa não pegou,
  // Linha solta: return (global as unknown as Record<string, unknown>).Xxx;
  // → fazer um map manual conhecido de InstanceName → TypeName
  const castMap = {
    auditServiceInstance: 'AuditService',
    storageServiceInstance: 'StorageService',
    settingsServiceInstance: 'SettingsService',
    subscriberBillingServiceInstance: 'SubscriberBillingService',
    publisherBillingServiceInstance: 'PublisherBillingService',
    campaignServiceInstance: 'CampaignService',
    mediaServiceInstance: 'MediaService',
    totemServiceInstance: 'TotemService',
    subscriptionServiceInstance: 'SubscriptionService',
    subscriberServiceInstance: 'SubscriberService',
    publisherServiceInstance: 'PublisherService',
    authServiceInstance: 'AuthService',
    permissionServiceInstance: 'PermissionService',
    qrcodeServiceInstance: 'QrCodeService',
    backupServiceInstance: 'BackupService',
    localServiceInstance: 'LocalService',
    userServiceInstance: 'UserService',
    roleServiceInstance: 'RoleService',
    playlistServiceInstance: 'PlaylistService',
    playerServiceInstance: 'PlayerService',
    contractServiceInstance: 'ContractService',
    alertServiceInstance: 'AlertService',
    aiServiceInstance: 'AIService',
    dashboardLayoutServiceInstance: 'DashboardLayoutService',
    exportScheduleServiceInstance: 'ExportScheduleService',
    exportQueryServiceInstance: 'ExportQueryService',
    financialAdminServiceInstance: 'FinancialAdminService',
    invoiceServiceInstance: 'InvoiceService',
    reconcileServiceInstance: 'ReconcileService',
    billingEnforcementServiceInstance: 'BillingEnforcementService',
    deviceTokenServiceInstance: 'DeviceTokenService',
    logRotationServiceInstance: 'LogRotationService',
    tagServiceInstance: 'TagService',
    portalDnsCloudflareServiceInstance: 'PortalDnsCloudflareService',
    otaUpdateServiceInstance: 'OtaUpdateService',
    smartTvServiceInstance: 'SmartTvService',
    smartPlaylistServiceInstance: 'SmartPlaylistService',
    totemPlaylistMixServiceInstance: 'TotemPlaylistMixService',
    publisherCampaignMixServiceInstance: 'PublisherCampaignMixService',
    playerDebugServiceInstance: 'PlayerDebugService',
    playbackTelemetryServiceInstance: 'PlaybackTelemetryService',
    facialRecognitionServiceInstance: 'FacialRecognitionService',
    fxEffectServiceInstance: 'FxEffectService',
    fxMessageBridgeServiceInstance: 'FxMessageBridgeService',
    fxOrchestratorServiceInstance: 'FxOrchestratorService',
    fxRuleServiceInstance: 'FxRuleService',
    fxSiteServiceInstance: 'FxSiteService',
    fxTelemetryServiceInstance: 'FxTelemetryService',
    fxTimelineServiceInstance: 'FxTimelineService',
    remoteCommandServiceInstance: 'RemoteCommandService',
    remoteScreenshotStorageServiceInstance: 'RemoteScreenshotStorageService',
    dispatcherRouterServiceInstance: 'DispatcherRouterService',
    mediaTotemSyncServiceInstance: 'MediaTotemSyncService',
    contractAuditServiceInstance: 'ContractAuditService',
    menuCatalogServiceInstance: 'MenuCatalogService',
    quickPublishServiceInstance: 'QuickPublishService',
    simplePublishServiceInstance: 'SimplePublishService',
    publishBoardServiceInstance: 'PublishBoardService',
    publishTemplateServiceInstance: 'PublishTemplateService',
    htmlBoardThumbnailServiceInstance: 'HtmlBoardThumbnailService',
    portalHostServiceInstance: 'PortalHostService',
    playerSyncServiceInstance: 'PlayerSyncService',
    installationModulesServiceInstance: 'InstallationModulesService',
    installationProfileServiceInstance: 'InstallationProfileService',
    eventLogServiceInstance: 'EventLogService',
    exportExecutionServiceInstance: 'ExportExecutionService',
    commercialPurgeServiceInstance: 'CommercialPurgeService',
    totemDirectMediaServiceInstance: 'TotemDirectMediaService',
    totemSimpleModeServiceInstance: 'TotemSimpleModeService',
    totemLogServiceInstance: 'TotemLogService',
    subscriberAccessServiceInstance: 'SubscriberAccessService',
    mediaDeletionServiceInstance: 'MediaDeletionService',
    mediaConfigServiceInstance: 'MediaConfigService',
    billingControlServiceInstance: 'BillingControlService',
    auditServiceInstance2: 'AuditService',
    analyticsServiceInstance: 'AnalyticsService',
  };
  for (const [inst, type] of Object.entries(castMap)) {
    const re = new RegExp(`return\\s*\\(\\s*global\\s+as\\s+(?:unknown\\s+as\\s+)?Record<string,\\s*unknown>\\s*\\)\\.${inst}\\s*;(?!\\s*\\/\\/)`, 'g');
    const hits = src.match(re);
    if (hits) {
      src = src.replace(re, `return (global as unknown as Record<string, unknown>).${inst} as ${type};`);
      total += hits.length;
    }
  }

  if (src !== orig) {
    fs.writeFileSync(fp, src, 'utf8');
    changed++;
    console.log(`✅ ${f}`);
  }
}

console.log(`\n📊 Casts finais em singleton getters: ${changed} arquivos | ${total} casts adicionados`);
