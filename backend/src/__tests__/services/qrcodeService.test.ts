/**
 * QRCode Service Tests - Smart Signage v2.1
 */

import { QRCodeService } from '../../services/qrcodeService';
import { getDatabase } from '../../config/database';

const logMock = jest.fn().mockResolvedValue(undefined);

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/auditService', () => ({
  AuditService: jest.fn().mockImplementation(() => ({ log: logMock })),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,AAA'),
}));

const toDataURL = require('qrcode').toDataURL as jest.Mock;

describe('QRCodeService', () => {
  let service: QRCodeService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    delete (global as any).auditServiceInstance;

    mockDb = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      executeRaw: jest.fn().mockResolvedValue({ rows: [] }),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (require('qrcode').toDataURL as jest.Mock).mockImplementation(toDataURL);

    service = new QRCodeService();

    (global as any).auditServiceInstance = {
      log: logMock,
    };
  });

  describe('getQRCodes', () => {
    it('deve listar QR Codes adicionando informações extras e imagem', async () => {
      const expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockDb.findMany.mockResolvedValueOnce([
        {
          id: 1,
          clientId: 1,
          title: 'QR Teste',
          qrType: 'url',
          content: 'https://example.com',
          size: 200,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          errorCorrectionLevel: 'M',
          margin: 4,
          isActive: 1,
          expiresAt,
          maxScans: 10,
          scanCount: 12,
        },
      ]);
      mockDb.findFirst.mockResolvedValueOnce({ total: '1' });

      const result = await service.getQRCodes(1, 20);

      expect(result.qrCodes).toHaveLength(1);
      expect(result.qrCodes[0]).toMatchObject({ isExpired: true, isMaxScansReached: true });
      expect(toDataURL).toHaveBeenCalled();
    });
  });

  describe('createQRCode', () => {
    it('deve criar QR Code e registrar auditoria', async () => {
      const now = new Date().toISOString();
      mockDb.findFirst
        .mockResolvedValueOnce({ client_id: 1 }) // cliente
        .mockResolvedValueOnce({ totem_id: 2 }) // totem
        .mockResolvedValueOnce({ campaign_id: 3 }) // campanha
        .mockResolvedValueOnce({
          id: 5,
          clientId: 1,
          title: 'QR Teste',
          qrType: 'url',
          content: 'https://example.com',
          size: 200,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          errorCorrectionLevel: 'M',
          margin: 4,
          isActive: 1,
          expiresAt: now,
          maxScans: 100,
          scanCount: 0,
        });

      mockDb.executeRaw.mockResolvedValueOnce({ lastInsertRowid: 5 });

      const result = await service.createQRCode({
        clientId: 1,
        totemId: 2,
        campaignId: 3,
        title: 'QR Teste',
        qrType: 'url',
        content: 'https://example.com',
        description: 'Teste',
      }, 99);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO qr_codes'), expect.any(Array));
      expect(logMock).toHaveBeenCalledWith('qr_code', 'created', 99, expect.objectContaining({ qrCodeId: 5 }));
      expect(result.id).toBe(5);
      expect(toDataURL).toHaveBeenCalled();
    });
  });
});
