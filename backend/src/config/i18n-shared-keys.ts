// sharedKeys — contrato frontend ↔ backend i18n
// Estas chaves existem EM AMBOS ambientes com a mesma semântica.
// Se alterar em algum lado, atualizar também no outro.
// Organizado por namespace; para compor chave completa: `${namespace}:${key}`

export const sharedNamespaces = [
  'common',
  'nav',
  'dashboard',
  'dashboards',
  'auth',
  'errors',
  'crud',
  'entities',
  'totem',
  'media',
  'campaign',
  'playlist',
  'billing',
  'publisher',
  'subscriber',
  'contract',
  'ai',
  'dispatcher',
  'system',
  'backup',
  'logs',
  'portal',
  'validation',
  'health',
  'fx',
  'ace',
  'reports',
  'roles',
  'data'
] as const;

export type SharedNamespace = typeof sharedNamespaces[number];

// Keys de alto valor compartilhado (frontend usa, backend envia mensagens)
export const sharedKeys = {
  auth: {
    login: 'auth:login',
    logout: 'auth:logout',
    username: 'auth:username',
    password: 'auth:password',
    forgotPassword: 'auth:forgotPassword',
    resetPassword: 'auth:resetPassword',
    loginSuccess: 'auth:loginSuccess',
    invalidCredentials: 'auth:invalidCredentials',
    inactiveUser: 'auth:inactiveUser',
    notAuthorized: 'auth:notAuthorized',
    tokenExpired: 'auth:tokenExpired',
    resetRequested: 'auth:resetRequested',
    resetTokenInvalid: 'auth:resetTokenInvalid',
    resetSuccess: 'auth:resetSuccess'
  },
  errors: {
    generic: 'errors:generic',
    network: 'errors:network',
    unauthorized: 'errors:unauthorized',
    notFound: 'errors:notFound',
    badRequest: 'errors:badRequest',
    serverError: 'errors:serverError',
    serviceUnavailable: 'errors:serviceUnavailable',
    conflict: 'errors:conflict',
    tooManyRequests: 'errors:tooManyRequests',
    forbidden: 'errors:forbidden',
    validationFailed: 'errors:validationFailed',
    requiredField: 'errors:requiredField',
    invalidField: 'errors:invalidField',
    databaseError: 'errors:databaseError',
    duplicateKey: 'errors:duplicateKey',
    missingTable: 'errors:missingTable',
    accessDenied: 'errors:accessDenied'
  },
  common: {
    save: 'common:save',
    cancel: 'common:cancel',
    delete: 'common:delete',
    edit: 'common:edit',
    create: 'common:create',
    search: 'common:search',
    filter: 'common:filter',
    export: 'common:export',
    loading: 'common:loading',
    error: 'common:error',
    success: 'common:success',
    warning: 'common:warning',
    info: 'common:info'
  },
  media: {
    notFound: 'media:notFound',
    uploadFailed: 'media:uploadFailed',
    processFailed: 'media:processFailed',
    invalidType: 'media:invalidType',
    fileTooLarge: 'media:fileTooLarge',
    deletionSuccess: 'media:deletionSuccess'
  },
  billing: {
    notFound: 'billing:notFound',
    alreadyPaid: 'billing:alreadyPaid',
    overdue: 'billing:overdue',
    paymentSuccess: 'billing:paymentSuccess',
    paymentFailed: 'billing:paymentFailed',
    pending: 'billing:pending',
    issued: 'billing:issued',
    cancelled: 'billing:cancelled',
    refunded: 'billing:refunded',
    providerError: 'billing:providerError',
    missingAmount: 'billing:missingAmount'
  },
  nav: {
    dashboard: 'nav:dashboard',
    users: 'nav:users',
    clients: 'nav:clients',
    media: 'nav:media',
    playlists: 'nav:playlists',
    campaigns: 'nav:campaigns',
    totems: 'nav:totems',
    analytics: 'nav:analytics',
    reports: 'nav:reports',
    settings: 'nav:settings',
    billing: 'nav:billing'
  },
  dashboard: {
    title: 'dashboard:title',
    totalClients: 'dashboard:totalClients',
    totalTotems: 'dashboard:totalTotems',
    totalCampaigns: 'dashboard:totalCampaigns',
    totalMedia: 'dashboard:totalMedia',
    onlineTotems: 'dashboard:onlineTotems',
    offlineTotems: 'dashboard:offlineTotems'
  },
  dashboards: {
    'nav.root': 'dashboards:nav.root',
    'nav.ace': 'dashboards:nav.ace',
    'nav.fx': 'dashboards:nav.fx',
    'nav.general': 'dashboards:nav.general',
    'common.refresh': 'dashboards:common.refresh',
    'common.startDate': 'dashboards:common.startDate',
    'common.endDate': 'dashboards:common.endDate',
    'common.granularity': 'dashboards:common.granularity',
    'ace.title': 'dashboards:ace.title',
    'ace.kpi.totalDetections': 'dashboards:ace.kpi.totalDetections',
    'ace.kpi.uniqueFaces': 'dashboards:ace.kpi.uniqueFaces',
    'ace.kpi.engagementRate': 'dashboards:ace.kpi.engagementRate',
    'ace.kpi.recallRate': 'dashboards:ace.kpi.recallRate',
    'ace.kpi.avgWatchTime': 'dashboards:ace.kpi.avgWatchTime',
    'fx.title': 'dashboards:fx.title',
    'fx.kpi.totalExecutions': 'dashboards:fx.kpi.totalExecutions',
    'fx.kpi.avgLatencyMs': 'dashboards:fx.kpi.avgLatencyMs',
    'fx.kpi.fleetUptime': 'dashboards:fx.kpi.fleetUptime',
    'fx.kpi.syncSuccess': 'dashboards:fx.kpi.syncSuccess',
    'fx.kpi.totalErrors': 'dashboards:fx.kpi.totalErrors',
    'general.title': 'dashboards:general.title',
    'general.kpi.totalImpressions': 'dashboards:general.kpi.totalImpressions',
    'general.kpi.totalPlays': 'dashboards:general.kpi.totalPlays',
    'general.kpi.ctrPercent': 'dashboards:general.kpi.ctrPercent',
    'general.kpi.avgWatchTimeSec': 'dashboards:general.kpi.avgWatchTimeSec',
    'general.kpi.fleetUptimePercent': 'dashboards:general.kpi.fleetUptimePercent',
    'general.billing.title': 'dashboards:general.billing.title',
    'general.billing.currentMonthCost': 'dashboards:general.billing.currentMonthCost',
    'general.billing.projectedCost': 'dashboards:general.billing.projectedCost'
  },
  crud: {
    created: 'crud:created',
    updated: 'crud:updated',
    deleted: 'crud:deleted',
    createFailed: 'crud:createFailed',
    updateFailed: 'crud:updateFailed',
    deleteFailed: 'crud:deleteFailed',
    notFound: 'crud:notFound',
    alreadyExists: 'crud:alreadyExists'
  },
  validation: {
    invalidEmail: 'validation:invalidEmail',
    invalidPhone: 'validation:invalidPhone',
    invalidUrl: 'validation:invalidUrl',
    invalidDate: 'validation:invalidDate',
    minLength: 'validation:minLength',
    maxLength: 'validation:maxLength',
    passwordMismatch: 'validation:passwordMismatch'
  }
} as const;

export type SharedKeyCatalog = typeof sharedKeys;
export default sharedKeys;
