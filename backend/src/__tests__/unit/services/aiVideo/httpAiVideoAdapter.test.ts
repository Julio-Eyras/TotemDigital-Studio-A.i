const mockAiVideoConfig = {
  provider: 'http',
  apiUrl: '',
  apiKey: '',
  timeoutMs: 120000,
};

jest.mock('../../../../config/env', () => ({
  aiVideoConfig: mockAiVideoConfig,
}));

import { generateVideoViaHttp } from '../../../../services/aiVideo/httpAiVideoAdapter';

describe('httpAiVideoAdapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockAiVideoConfig.apiUrl = '';
    mockAiVideoConfig.apiKey = '';
    mockAiVideoConfig.timeoutMs = 120000;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('falha quando API URL não está configurada', async () => {
    const result = await generateVideoViaHttp({
      subscriberId: 1,
      preset: 'promotion',
      briefSummary: 'Oferta',
      userId: 9,
    });
    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/AI_VIDEO_API_URL/);
  });

  it('retorna videoUrl quando provedor responde com sucesso', async () => {
    mockAiVideoConfig.apiUrl = 'https://video.example/generate';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://cdn.example/out.mp4' }),
    }) as typeof fetch;

    const result = await generateVideoViaHttp({
      subscriberId: 2,
      preset: 'ad',
      userId: 1,
    });

    expect(result.status).toBe('completed');
    expect(result.videoUrl).toBe('https://cdn.example/out.mp4');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://video.example/generate',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('propaga erro HTTP do provedor', async () => {
    mockAiVideoConfig.apiUrl = 'https://video.example/generate';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'upstream down' }),
    }) as typeof fetch;

    const result = await generateVideoViaHttp({
      subscriberId: 1,
      preset: 'menu',
      userId: 1,
    });

    expect(result.status).toBe('failed');
    expect(result.message).toBe('upstream down');
  });
});
