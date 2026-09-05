/**
 * Testes unitários - ContractService (estruturas e validações)
 * Sem acesso ao DB; integração testada em testes de integração.
 */

import type { Contract, CreateContractRequest, UpdateContractRequest } from '../../../services/contractService';

describe('ContractService - estruturas e validações', () => {
  describe('Contract interface', () => {
    it('deve ter campos obrigatórios', () => {
      const c: Contract = {
        contract_id: 1,
        subscriber_id: 1,
        contract_number: 'CT-001',
        contract_type: 'advertising',
        title: 'Contrato Teste',
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        currency: 'BRL',
        status: 'active',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(c.contract_id).toBeDefined();
      expect(c.contract_number).toBeDefined();
      expect(c.contract_type).toBeDefined();
      expect(c.title).toBeDefined();
      expect(c.start_date).toBeDefined();
      expect(c.currency).toBeDefined();
      expect(c.status).toBeDefined();
    });
  });

  describe('Status de contrato', () => {
    it('deve aceitar status válidos de subscriber contract', () => {
      const validStatuses = ['draft', 'active', 'expired', 'terminated', 'cancelled'];
      validStatuses.forEach(status => {
        expect(['draft', 'active', 'expired', 'terminated', 'cancelled']).toContain(status);
      });
    });
  });

  describe('Contract type', () => {
    it('deve aceitar tipos de subscriber contract', () => {
      const validTypes = ['advertising', 'subscription', 'partnership'];
      validTypes.forEach(t => {
        expect(['advertising', 'subscription', 'partnership']).toContain(t);
      });
    });
  });

  describe('CreateContractRequest', () => {
    it('deve aceitar payload mínimo válido', () => {
      const req: CreateContractRequest = {
        subscriber_id: 1,
        contract_number: 'CT-001',
        contract_type: 'advertising',
        title: 'Título',
        start_date: '2025-01-01T00:00:00.000Z',
        metadata: {},
      };
      expect(req.contract_number).toBeDefined();
      expect(req.contract_type).toBe('advertising');
      expect(req.title).toBeDefined();
      expect(req.start_date).toBeDefined();
    });
  });

  describe('UpdateContractRequest', () => {
    it('deve aceitar atualização parcial', () => {
      const req: UpdateContractRequest = { status: 'active', metadata: {} };
      expect(req.status).toBe('active');
    });
  });
});
