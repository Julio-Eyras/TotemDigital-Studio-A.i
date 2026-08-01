/**
 * Unit: initializeOperationalWorkers respects capability flags (Etapa E).
 */
import { initializeOperationalWorkers } from '../../../startup/startupOperationalWorkers';

const startInvoice = jest.fn();
const startFinancial = jest.fn();
const startSubscriber = jest.fn();
const startEngine = jest.fn();
const startMix = jest.fn();
const cronSchedule = jest.fn();
const initExport = jest.fn();
const regExport = jest.fn();
const initAdv = jest.fn();
const regAdv = jest.fn();
const loadSchedules = jest.fn().mockResolvedValue(undefined);

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: (...args: unknown[]) => cronSchedule(...args) },
}));

jest.mock('../../../config/queue', () => ({
  initializeExportQueue: () => initExport(),
  initializeAdvancedScheduleQueue: () => initAdv(),
}));

jest.mock('../../../workers/exportWorker', () => ({
  registerExportWorker: () => regExport(),
}));

jest.mock('../../../workers/advancedScheduleWorker', () => ({
  registerAdvancedScheduleWorker: () => regAdv(),
}));

jest.mock('../../../services/exportScheduleService', () => ({
  exportScheduleService: {
    loadAllActiveSchedules: () => loadSchedules(),
  },
}));

jest.mock('../../../workers/invoiceWorker', () => ({
  InvoiceWorker: jest.fn().mockImplementation(() => ({ start: startInvoice })),
}));

jest.mock('../../../workers/financialBillingWorker', () => ({
  FinancialBillingWorker: jest.fn().mockImplementation(() => ({ start: startFinancial })),
}));

jest.mock('../../../workers/subscriberAccessNotificationWorker', () => ({
  SubscriberAccessNotificationWorker: jest.fn().mockImplementation(() => ({
    start: startSubscriber,
  })),
}));

jest.mock('../../../workers/playlistEngineWorker', () => ({
  getPlaylistEngineWorkerInstance: () => ({ start: startEngine }),
}));

jest.mock('../../../workers/playlistMixWorker', () => ({
  getPlaylistMixWorker: () => ({ start: startMix }),
}));

jest.mock('../../../services/alertService', () => ({
  getAlertService: () => ({ checkAllAlerts: jest.fn().mockResolvedValue([]) }),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn().mockResolvedValue(undefined),
  logWarn: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
}));

describe('initializeOperationalWorkers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('núcleo: sem Bull, billing, playlists nem alertas', async () => {
    await initializeOperationalWorkers({
      redisEnabled: true,
      enableBullQueues: false,
      enableBillingWorkers: false,
      enablePlaylistMix: false,
      enablePlaylistEngine: false,
      enableAlertCron: false,
      enableSubscriberAccessWorker: false,
      logLabel: 'test',
    });

    expect(initExport).not.toHaveBeenCalled();
    expect(startInvoice).not.toHaveBeenCalled();
    expect(startFinancial).not.toHaveBeenCalled();
    expect(startSubscriber).not.toHaveBeenCalled();
    expect(startEngine).not.toHaveBeenCalled();
    expect(startMix).not.toHaveBeenCalled();
    expect(cronSchedule).not.toHaveBeenCalled();
  });

  it('multi-agência: arranca Bull + billing + playlists + alertas', async () => {
    await initializeOperationalWorkers({
      redisEnabled: true,
      enableBullQueues: true,
      enableBillingWorkers: true,
      enablePlaylistMix: true,
      enablePlaylistEngine: true,
      enableAlertCron: true,
      enableSubscriberAccessWorker: true,
      logLabel: 'test',
    });

    expect(initExport).toHaveBeenCalled();
    expect(regExport).toHaveBeenCalled();
    expect(initAdv).toHaveBeenCalled();
    expect(regAdv).toHaveBeenCalled();
    expect(loadSchedules).toHaveBeenCalled();
    expect(startInvoice).toHaveBeenCalled();
    expect(startFinancial).toHaveBeenCalled();
    expect(startSubscriber).toHaveBeenCalled();
    expect(startEngine).toHaveBeenCalled();
    expect(startMix).toHaveBeenCalled();
    expect(cronSchedule).toHaveBeenCalled();
  });
});
