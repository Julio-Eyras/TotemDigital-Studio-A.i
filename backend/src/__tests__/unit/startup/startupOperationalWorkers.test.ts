/**
 * Unit: initializeOperationalWorkers respects capability flags (Etapa E/F).
 */
import cron from 'node-cron';
import {
  initializeOperationalWorkers,
  resetOperationalWorkersStateForTests,
} from '../../../startup/startupOperationalWorkers';

const startInvoice = jest.fn();
const startFinancial = jest.fn();
const startSubscriber = jest.fn();
const startEngine = jest.fn();
const startMix = jest.fn();
const cronSchedule = cron.schedule as unknown as jest.Mock;
const initExport = jest.fn();
const regExport = jest.fn();
const initAdv = jest.fn();
const regAdv = jest.fn();
const closeExport = jest.fn().mockResolvedValue(undefined);
const closeAdv = jest.fn().mockResolvedValue(undefined);
const loadSchedules = jest.fn().mockResolvedValue(undefined);

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: jest.fn(() => ({ stop: jest.fn() })) },
}));

jest.mock('../../../config/queue', () => ({
  initializeExportQueue: () => initExport(),
  initializeAdvancedScheduleQueue: () => initAdv(),
  closeExportQueue: () => closeExport(),
  closeAdvancedScheduleQueue: () => closeAdv(),
}));

jest.mock('../../../workers/exportWorker', () => ({
  registerExportWorker: () => regExport(),
  resetExportWorkerRegistration: jest.fn(),
}));

jest.mock('../../../workers/advancedScheduleWorker', () => ({
  registerAdvancedScheduleWorker: () => regAdv(),
  resetAdvancedScheduleWorkerRegistration: jest.fn(),
}));

jest.mock('../../../services/exportScheduleService', () => ({
  exportScheduleService: {
    loadAllActiveSchedules: () => loadSchedules(),
  },
}));

jest.mock('../../../workers/invoiceWorker', () => ({
  InvoiceWorker: function InvoiceWorker() {
    return { start: startInvoice, stop: jest.fn() };
  },
}));

jest.mock('../../../workers/financialBillingWorker', () => ({
  FinancialBillingWorker: function FinancialBillingWorker() {
    return { start: startFinancial, stop: jest.fn() };
  },
}));

jest.mock('../../../workers/subscriberAccessNotificationWorker', () => ({
  SubscriberAccessNotificationWorker: function SubscriberAccessNotificationWorker() {
    return { start: startSubscriber, stop: jest.fn() };
  },
}));

jest.mock('../../../workers/playlistEngineWorker', () => ({
  getPlaylistEngineWorkerInstance: () => ({ start: startEngine, stop: jest.fn() }),
}));

jest.mock('../../../workers/playlistMixWorker', () => ({
  getPlaylistMixWorker: () => ({ start: startMix, stop: jest.fn() }),
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
    cronSchedule.mockImplementation(() => ({ stop: jest.fn() }));
    closeExport.mockResolvedValue(undefined);
    closeAdv.mockResolvedValue(undefined);
    loadSchedules.mockResolvedValue(undefined);
    resetOperationalWorkersStateForTests();
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
    // Purge comercial corre sempre; alertas (*/5) só com enableAlertCron.
    expect(cronSchedule).toHaveBeenCalledWith('* * * * *', expect.any(Function));
    expect(cronSchedule.mock.calls.some((c: string[]) => c[0] === '*/5 * * * *')).toBe(false);
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

  it('hot-reload: desligar Bull fecha filas sem reiniciar processo', async () => {
    await initializeOperationalWorkers({
      redisEnabled: true,
      enableBullQueues: true,
      enableBillingWorkers: true,
      enablePlaylistMix: false,
      enablePlaylistEngine: false,
      enableAlertCron: false,
      enableSubscriberAccessWorker: false,
      logLabel: 'test',
    });
    expect(initExport).toHaveBeenCalled();

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

    expect(closeExport).toHaveBeenCalled();
    expect(closeAdv).toHaveBeenCalled();
  });
});
