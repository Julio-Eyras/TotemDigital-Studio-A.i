import { formatIssueInvoicesMessage, formatRevenueSharePayoutMessage } from './formatIssueInvoicesResult';

describe('formatIssueInvoicesResult', () => {
  it('formata mensagem de emissão', () => {
    expect(
      formatIssueInvoicesMessage({ created: 2, skipped: 1, errors: [] })
    ).toContain('2 criada(s)');
  });

  it('formata repasse quando houve criação', () => {
    expect(
      formatRevenueSharePayoutMessage({ created: 1, skipped: 0, errors: [] })
    ).toContain('Repasse organização');
  });

  it('retorna null se repasse vazio', () => {
    expect(formatRevenueSharePayoutMessage({ created: 0, skipped: 2, errors: [] })).toBeNull();
  });
});
