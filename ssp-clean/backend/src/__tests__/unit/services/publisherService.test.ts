/**
 * Testes unitários - PublisherService (estruturas e payload createPublisherWithResources)
 * Sem acesso ao DB; procedure testada em testes de integração.
 */

import type {
  Publisher,
  CreatePublisherRequest,
  UpdatePublisherRequest,
  PublisherListResponse
} from '../../../services/publisherService';

describe('PublisherService - estruturas e payloads', () => {
  describe('Publisher interface', () => {
    it('deve ter campos obrigatórios', () => {
      const p: Publisher = {
        publisher_id: 1,
        name: 'Test Pub',
        is_subscriber: false,
        is_publisher: true,
        client_type: 'publisher',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(p.publisher_id).toBeDefined();
      expect(p.name).toBe('Test Pub');
      expect(p.is_publisher).toBe(true);
      expect(p.client_type).toBe('publisher');
    });
  });

  describe('CreatePublisherRequest', () => {
    it('deve aceitar payload mínimo (só name)', () => {
      const req: CreatePublisherRequest = { name: 'Editora X' };
      expect(req.name).toBe('Editora X');
    });

    it('deve aceitar campos opcionais', () => {
      const req: CreatePublisherRequest = {
        name: 'Editora Y',
        contact_name: 'Contato',
        email: 'contato@editora.com',
        category_segment: 'Shopping',
      };
      expect(req.contact_name).toBe('Contato');
      expect(req.email).toBeDefined();
    });
  });

  describe('Payload createPublisherWithResources', () => {
    it('deve aceitar publisher + arrays opcionais (locals, totems, smartTvs, contracts)', () => {
      const payload = {
        publisher: { name: 'Pub Z' } as CreatePublisherRequest,
        locals: [] as any[],
        totems: [] as any[],
        smartTvs: [] as any[],
        contracts: [] as any[],
      };
      expect(payload.publisher.name).toBe('Pub Z');
      expect(Array.isArray(payload.locals)).toBe(true);
      expect(Array.isArray(payload.contracts)).toBe(true);
    });

    it('contracts podem ter title e sem contract_number (gerado no banco)', () => {
      const payload = {
        publisher: { name: 'Pub' } as CreatePublisherRequest,
        contracts: [
          { title: 'Contrato 2025', contract_type: 'revenue_share' },
          { title: 'Aditivo' },
        ],
      };
      expect(payload.contracts[0].title).toBe('Contrato 2025');
      expect((payload.contracts[0] as any).contract_number).toBeUndefined();
    });
  });

  describe('UpdatePublisherRequest', () => {
    it('deve aceitar atualização parcial', () => {
      const req: UpdatePublisherRequest = { name: 'Novo Nome', active: false };
      expect(req.name).toBe('Novo Nome');
      expect(req.active).toBe(false);
    });
  });

  describe('PublisherListResponse', () => {
    it('deve ter data, total, page, limit', () => {
      const res: PublisherListResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      };
      expect(res.data).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(10);
    });
  });
});
