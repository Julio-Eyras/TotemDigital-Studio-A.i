import { PublishVideoAiProcessorService } from '../../../../services/aiVideo/publishVideoAiProcessorService';

const mockHasPremium = jest.fn();
const mockGenerateVideo = jest.fn();
const mockCreateMedia = jest.fn();
const mockExecuteRaw = jest.fn();
const mockFindMany = jest.fn();

jest.mock('../../../../utils/publishPlanFeatures', () => ({
  subscriberHasPremiumAiVideo: (...args: unknown[]) => mockHasPremium(...args),
}));

jest.mock('../../../../services/aiVideo/httpAiVideoAdapter', () => ({
  generateVideoViaHttp: (...args: unknown[]) => mockGenerateVideo(...args),
}));

jest.mock('../../../../services/mediaService', () => ({
  getMediaService: () => ({
    createMedia: (...args: unknown[]) => mockCreateMedia(...args),
  }),
}));

jest.mock('../../../../config/env', () => ({
  aiVideoConfig: {
    provider: 'http',
    apiUrl: 'https://video.example/generate',
    apiKey: 'test-key',
    timeoutMs: 120000,
  },
}));

jest.mock('../../../../config/database', () => ({
  getDatabase: () => ({
    executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
    findMany: (...args: unknown[]) => mockFindMany(...args),
  }),
}));

jest.mock('../../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

describe('PublishVideoAiProcessorService', () => {
  const service = new PublishVideoAiProcessorService();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecuteRaw.mockResolvedValue({ rowCount: 1 });
    mockFindMany.mockResolvedValue([]);
    mockHasPremium.mockResolvedValue(true);
    mockGenerateVideo.mockResolvedValue({
      status: 'completed',
      message: 'OK',
      videoUrl: 'https://cdn.example/video.mp4',
      provider: 'http',
    });
    mockCreateMedia.mockResolvedValue({ id: 55, name: 'Vídeo IA — promotion' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('retorna premiumRequired quando anunciante não é Premium', async () => {
    mockHasPremium.mockResolvedValueOnce(false);
    const result = await service.run({
      subscriberId: 1,
      preset: 'promotion',
      userId: 9,
    });
    expect(result.premiumRequired).toBe(true);
    expect(result.status).toBe('failed');
    expect(mockGenerateVideo).not.toHaveBeenCalled();
  });

  it('importa vídeo e retorna mediaId quando provedor HTTP conclui', async () => {
    const result = await service.run({
      subscriberId: 2,
      preset: 'ad',
      briefSummary: 'Campanha',
      userId: 1,
    });
    expect(result.status).toBe('completed');
    expect(result.mediaId).toBe(55);
    expect(mockGenerateVideo).toHaveBeenCalled();
    expect(mockCreateMedia).toHaveBeenCalled();
    expect(mockExecuteRaw).toHaveBeenCalled();
  });

  it('retorna failed quando provedor HTTP falha', async () => {
    mockGenerateVideo.mockResolvedValueOnce({
      status: 'failed',
      message: 'upstream down',
      provider: 'http',
    });
    const result = await service.run({
      subscriberId: 1,
      preset: 'menu',
      userId: 1,
    });
    expect(result.status).toBe('failed');
    expect(result.message).toBe('upstream down');
    expect(mockCreateMedia).not.toHaveBeenCalled();
  });

  it('getJobStatus localiza job por jobId no audit', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        metadata: JSON.stringify({
          jobId: 'vai-1-99',
          status: 'completed',
          message: 'Pronto',
          mediaId: 88,
          mediaName: 'Vídeo IA',
          provider: 'http',
        }),
      },
    ]);
    const result = await service.getJobStatus('vai-1-99', 1);
    expect(result?.status).toBe('completed');
    expect(result?.mediaId).toBe(88);
  });
});
