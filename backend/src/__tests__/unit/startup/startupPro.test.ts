import { initializeProStartup } from '../../../startup/startupPro';
import {
  initializeExportQueue,
  initializeAdvancedScheduleQueue,
} from '../../../config/queue';
import { registerExportWorker } from '../../../workers/exportWorker';
import { registerAdvancedScheduleWorker } from '../../../workers/advancedScheduleWorker';
import { exportScheduleService } from '../../../services/exportScheduleService';
import { InvoiceWorker } from '../../../workers/invoiceWorker';
import { SubscriberAccessNotificationWorker } from '../../../workers/subscriberAccessNotificationWorker';
import { getPlaylistEngineWorkerInstance } from '../../../workers/playlistEngineWorker';
import { getPlaylistMixWorker } from '../../../workers/playlistMixWorker';
import { getAlertService } from '../../../services/alertService';
import cron from 'node-cron';
import { logInfo } from '../../../utils/loggerHelper';

jest.mock('../../../config/queue', () => ({
  initializeExportQueue: jest.fn(),
  initializeAdvancedScheduleQueue: jest.fn(),
}));

jest.mock('../../../workers/exportWorker', () => ({
  registerExportWorker: jest.fn(),
}));

jest.mock('../../../workers/advancedScheduleWorker', () => ({
  registerAdvancedScheduleWorker: jest.fn(),
}));

jest.mock('../../../services/exportScheduleService', () => ({
  exportScheduleService: {
    loadAllActiveSchedules: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../workers/invoiceWorker', () => ({
  InvoiceWorker: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
  })),
}));

jest.mock('../../../workers/subscriberAccessNotificationWorker', () => ({
  SubscriberAccessNotificationWorker: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
  })),
}));

jest.mock('../../../workers/playlistEngineWorker', () => ({
  getPlaylistEngineWorkerInstance: jest.fn().mockReturnValue({
    start: jest.fn(),
  }),
}));

jest.mock('../../../workers/playlistMixWorker', () => ({
  getPlaylistMixWorker: jest.fn().mockReturnValue({
    start: jest.fn(),
  }),
}));

jest.mock('../../../services/alertService', () => ({
  getAlertService: jest.fn().mockReturnValue({
    checkAllAlerts: jest.fn().mockResolvedValue([]),
    sendAlert: jest.fn().mockResolvedValue(undefined),
    alertRules: [],
  }),
}));

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    schedule: jest.fn(),
  },
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn().mockResolvedValue(undefined),
  logWarn: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
}));

describe('initializeProStartup', () => {
  beforeEach(() => {
    (initializeExportQueue as jest.Mock).mockImplementation(() => undefined);
    (registerExportWorker as jest.Mock).mockImplementation(() => undefined);
    (initializeAdvancedScheduleQueue as jest.Mock).mockImplementation(() => undefined);
    (registerAdvancedScheduleWorker as jest.Mock).mockImplementation(() => undefined);

    (exportScheduleService.loadAllActiveSchedules as jest.Mock).mockResolvedValue(undefined);

    (InvoiceWorker as unknown as jest.Mock).mockImplementation(() => ({
      start: jest.fn(),
    }));
    (SubscriberAccessNotificationWorker as unknown as jest.Mock).mockImplementation(() => ({
      start: jest.fn(),
    }));
    (getPlaylistEngineWorkerInstance as jest.Mock).mockReturnValue({
      start: jest.fn(),
    });
    (getPlaylistMixWorker as jest.Mock).mockReturnValue({
      start: jest.fn(),
    });
    (getAlertService as jest.Mock).mockReturnValue({
      checkAllAlerts: jest.fn().mockResolvedValue([]),
      sendAlert: jest.fn().mockResolvedValue(undefined),
      alertRules: [],
    });
    (cron.schedule as jest.Mock).mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete (global as any).invoiceWorker;
    delete (global as any).subscriberAccessNotificationWorker;
    delete (global as any).playlistEngineWorker;
    delete (global as any).playlistMixWorker;
  });

  it('deve inicializar filas quando redisEnabled=true e registrar cron', async () => {
    await initializeProStartup({ redisEnabled: true });

    expect(initializeExportQueue).toHaveBeenCalled();
    expect(registerExportWorker).toHaveBeenCalled();
    expect(initializeAdvancedScheduleQueue).toHaveBeenCalled();
    expect(registerAdvancedScheduleWorker).toHaveBeenCalled();
    expect(exportScheduleService.loadAllActiveSchedules).toHaveBeenCalled();
    expect((cron.schedule as jest.Mock)).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));

    expect(InvoiceWorker as unknown as jest.Mock).toHaveBeenCalledTimes(1);
    expect(SubscriberAccessNotificationWorker as unknown as jest.Mock).toHaveBeenCalledTimes(1);
    expect(getPlaylistEngineWorkerInstance).toHaveBeenCalledTimes(1);
    expect((global as any).invoiceWorker).toBeDefined();
    expect((global as any).subscriberAccessNotificationWorker).toBeDefined();
    expect((global as any).playlistEngineWorker).toBeDefined();
    expect((global as any).playlistMixWorker).toBeDefined();
  });

  it('não deve inicializar filas quando redisEnabled=false', async () => {
    await initializeProStartup({ redisEnabled: false });

    expect(initializeExportQueue).not.toHaveBeenCalled();
    expect(registerExportWorker).not.toHaveBeenCalled();
    expect(initializeAdvancedScheduleQueue).not.toHaveBeenCalled();
    expect(registerAdvancedScheduleWorker).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith('Modo Pro sem Redis: filas Bull não serão inicializadas');
  });
});

