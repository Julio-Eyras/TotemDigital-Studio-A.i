import { buildIssueInvoicesPayload } from './billingIssuePayload';

describe('buildIssueInvoicesPayload', () => {
  const base = {
    subscriberId: '',
    contractId: '',
    publisherId: '',
    publisherContractId: '',
    dueInDays: '',
  };

  it('emite vazio para escopo all sem filtros', () => {
    expect(buildIssueInvoicesPayload({ ...base, scope: 'all' })).toEqual({});
  });

  it('filtra anunciante e contrato', () => {
    expect(
      buildIssueInvoicesPayload({
        ...base,
        scope: 'subscriber',
        subscriberId: '2',
        contractId: '10',
        dueInDays: '15',
      })
    ).toEqual({ subscriberId: 2, contractId: 10, dueInDays: 15 });
  });

  it('filtra exibidor e contrato', () => {
    expect(
      buildIssueInvoicesPayload({
        ...base,
        scope: 'publisher',
        publisherId: '1',
        publisherContractId: '5',
      })
    ).toEqual({ publisherId: 1, publisherContractId: 5 });
  });

  it('escopo all aceita IDs opcionais de ambos os lados', () => {
    expect(
      buildIssueInvoicesPayload({
        ...base,
        scope: 'all',
        subscriberId: '3',
        publisherContractId: '7',
      })
    ).toEqual({ subscriberId: 3, publisherContractId: 7 });
  });
});
