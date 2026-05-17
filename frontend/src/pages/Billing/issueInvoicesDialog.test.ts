import { eligiblePublisherContracts } from './IssueInvoicesDialog';
import type { PublisherContract } from '../../services/api';

const base = (over: Partial<PublisherContract>): PublisherContract =>
  ({
    contract_id: 1,
    contract_number: 'PC-1',
    contract_type: 'subscription',
    title: 'T',
    start_date: '2026-01-01',
    currency: 'BRL',
    status: 'active',
    created_at: '',
    updated_at: '',
    ...over,
  }) as PublisherContract;

describe('eligiblePublisherContracts', () => {
  it('inclui subscription/hybrid com valor positivo', () => {
    const list = eligiblePublisherContracts([
      base({ contract_type: 'subscription', subscription_amount: 100 }),
      base({ contract_id: 2, contract_type: 'hybrid', subscription_amount: 50 }),
    ]);
    expect(list).toHaveLength(2);
  });

  it('exclui revenue_share e assinatura sem valor', () => {
    const list = eligiblePublisherContracts([
      base({ contract_type: 'revenue_share', subscription_amount: 100 }),
      base({ contract_id: 2, contract_type: 'subscription', subscription_amount: 0 }),
    ]);
    expect(list).toHaveLength(0);
  });
});
