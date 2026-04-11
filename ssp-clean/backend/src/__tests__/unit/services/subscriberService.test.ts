/**
 * Testes unitários - SubscriberService (estruturas e payload createSubscriberWithContracts)
 * Sem acesso ao DB; procedure testada em testes de integração.
 */

import type {
  Subscriber,
  CreateSubscriberRequest,
  UpdateSubscriberRequest,
  SubscriberListResponse
} from '../../../services/subscriberService';

describe('SubscriberService - estruturas e payloads', () => {
  describe('Subscriber interface', () => {
    it('deve ter campos obrigatórios', () => {
      const s: Subscriber = {
        subscriber_id: 1,
        name: 'Anunciante X',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(s.subscriber_id).toBeDefined();
      expect(s.name).toBe('Anunciante X');
      expect(s.is_active).toBe(true);
    });
  });

  describe('CreateSubscriberRequest', () => {
    it('deve aceitar payload mínimo (só name)', () => {
      const req: CreateSubscriberRequest = { name: 'Anunciante Y' };
      expect(req.name).toBe('Anunciante Y');
    });

    it('deve aceitar campos opcionais', () => {
      const req: CreateSubscriberRequest = {
        name: 'Anunciante Z',
        contact_name: 'Contato',
        email: 'contato@anunciante.com',
        address: 'Endereço',
      };
      expect(req.contact_name).toBe('Contato');
      expect(req.email).toBeDefined();
    });
  });

  describe('Payload createSubscriberWithContracts', () => {
    it('deve aceitar subscriber + contracts (contract_number gerado no banco)', () => {
      const payload = {
        subscriber: { name: 'Anunciante' } as CreateSubscriberRequest,
        contracts: [
          { title: 'Contrato 2025', plan_id: 1 },
          { title: 'Aditivo', contract_type: 'advertising' },
        ],
      };
      expect(payload.subscriber.name).toBe('Anunciante');
      expect(payload.contracts).toHaveLength(2);
      expect(payload.contracts[0].title).toBe('Contrato 2025');
      expect(payload.contracts[0].plan_id).toBe(1);
    });

    it('contracts podem ter apenas title (obrigatório)', () => {
      const payload = {
        subscriber: { name: 'Sub' } as CreateSubscriberRequest,
        contracts: [{ title: 'Contrato único' }],
      };
      expect((payload.contracts[0] as any).contract_number).toBeUndefined();
    });
  });

  describe('UpdateSubscriberRequest', () => {
    it('deve aceitar atualização parcial', () => {
      const req: UpdateSubscriberRequest = { name: 'Novo Nome' };
      expect(req.name).toBe('Novo Nome');
    });
  });

  describe('SubscriberListResponse', () => {
    it('deve ter data, total, page, limit', () => {
      const res: SubscriberListResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      };
      expect(res.data).toEqual([]);
      expect(res.total).toBe(0);
    });
  });
});
