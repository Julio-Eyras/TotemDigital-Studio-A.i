import {
  getCampaignCreatedYmd,
  getCampaignStartYmdForDisplay,
  getMinCampaignStartYmd,
  getTodayYmd,
  resolveCampaignStartYmdForSave,
  toDateOnlyYmd,
} from './campaignStartDate';

describe('campaignStartDate (America/Sao_Paulo)', () => {
  it('preserva DATE puro do banco sem deslocamento', () => {
    expect(toDateOnlyYmd('2026-06-11')).toBe('2026-06-11');
    expect(getCampaignStartYmdForDisplay({ start_date: '2026-06-11' })).toBe('2026-06-11');
  });

  it('preserva start_date DATE em meia-noite UTC (node-pg)', () => {
    expect(getCampaignStartYmdForDisplay({ start_date: '2026-06-12T00:00:00.000Z' })).toBe(
      '2026-06-12'
    );
  });

  it('permite salvar início no mesmo dia da criação com DATE meia-noite UTC', () => {
    const campaign = {
      created_at: '2026-06-12T18:02:00.000Z',
      start_date: '2026-06-12T00:00:00.000Z',
    };
    expect(resolveCampaignStartYmdForSave(campaign)).toBe('2026-06-12');
  });

  it('converte created_at UTC para dia civil no Brasil', () => {
    // 12/06 01:12 UTC = 11/06 22:12 em São Paulo (UTC-3)
    const createdAt = '2026-06-12T01:12:00.000Z';
    expect(getCampaignCreatedYmd({ created_at: createdAt })).toBe('2026-06-11');
  });

  it('exibe start_date gravado sem clamp na UI', () => {
    const campaign = {
      created_at: '2026-06-12T01:12:00.000Z',
      start_date: '2026-06-11',
    };
    expect(getCampaignStartYmdForDisplay(campaign)).toBe('2026-06-11');
    expect(getMinCampaignStartYmd(campaign)).toBe('2026-06-11');
  });

  it('permite salvar início no mesmo dia da criação (fuso Brasil)', () => {
    const campaign = {
      created_at: '2026-06-12T01:12:00.000Z',
      start_date: '2026-06-11',
    };
    expect(resolveCampaignStartYmdForSave(campaign)).toBe('2026-06-11');
  });

  it('clamp ao salvar se início for anterior à criação', () => {
    const campaign = {
      created_at: '2026-06-15T12:00:00.000Z',
      start_date: '2026-06-10',
    };
    expect(resolveCampaignStartYmdForSave(campaign)).toBe('2026-06-15');
  });

  it('getTodayYmd retorna yyyy-mm-dd', () => {
    expect(getTodayYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
