import { RemoteCommandService } from '../../../services/remoteCommandService';

const mockExecuteRaw = jest.fn();

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({ executeRaw: mockExecuteRaw }),
}));
jest.mock('../../../config/database-pg', () => ({
  getDatabase: () => ({}),
}));
jest.mock('../../../config/schemaCompat', () => ({
  ensureRemoteCommandTypesConstraint: jest.fn(),
  isRemoteCommandTypeConstraintError: jest.fn(() => false),
}));
jest.mock('../../../services/eventLogService', () => ({
  EventType: {},
  getEventLogService: () => ({ logEvent: jest.fn() }),
}));
jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn(async () => undefined),
  logError: jest.fn(async () => undefined),
  logWarn: jest.fn(async () => undefined),
  logDebug: jest.fn(async () => undefined),
}));

describe('RemoteCommandService delivery lease', () => {
  beforeEach(() => {
    mockExecuteRaw.mockReset();
  });

  it('reserva pending e limita reentrega a comandos idempotentes', async () => {
    mockExecuteRaw.mockResolvedValueOnce({
      rows: [{
        command_id: 7,
        totem_id: 2,
        command_type: 'sync_now',
        status: 'sent',
        parameters: {},
        created_at: new Date(),
      }],
    });

    const commands = await new RemoteCommandService().claimPendingCommands(2, 10);

    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.stringContaining("sent_at < CURRENT_TIMESTAMP - INTERVAL '60 seconds'"),
      [2, 10],
    );
    expect(mockExecuteRaw.mock.calls[0][0]).toContain('retry_count < 3');
    expect(mockExecuteRaw.mock.calls[0][0]).toContain("'refresh_dispatch'");
    expect(mockExecuteRaw.mock.calls[0][0]).not.toContain("'reboot'");
    expect(mockExecuteRaw.mock.calls[0][0]).not.toContain("'restart_app'");
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ id: 7, commandType: 'sync_now' });
  });
});
