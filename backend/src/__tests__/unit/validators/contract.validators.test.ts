/**
 * Testes unitários - validators de contrato
 */

import { validationResult } from 'express-validator';
import {
  createSubscriberContractValidators,
  updateSubscriberContractValidators,
  createPublisherContractValidators,
  updatePublisherContractValidators,
} from '../../../validators/contract.validators';
import { runValidators } from '../../helpers/validatorRunner';

describe('contract.validators', () => {
  describe('createSubscriberContractValidators', () => {
    it('deve aceitar payload válido', async () => {
      const req = {
        body: {
          contract_number: 'CT-001',
          contract_type: 'advertising',
          title: 'Contrato de Publicidade',
          start_date: '2025-01-01T00:00:00.000Z',
          end_date: '2025-12-31T23:59:59.000Z',
          status: 'draft',
        },
      };
      await runValidators(req, createSubscriberContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar contract_type inválido', async () => {
      const req = {
        body: {
          contract_number: 'CT-001',
          contract_type: 'invalid_type',
          title: 'Título',
          start_date: '2025-01-01T00:00:00.000Z',
        },
      };
      await runValidators(req, createSubscriberContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
      expect(result.array().length).toBeGreaterThan(0);
    });

    it('deve rejeitar start_date inválida', async () => {
      const req = {
        body: {
          contract_number: 'CT-001',
          contract_type: 'advertising',
          title: 'Título',
          start_date: 'not-a-date',
        },
      };
      await runValidators(req, createSubscriberContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });

    it('deve rejeitar título vazio', async () => {
      const req = {
        body: {
          contract_number: 'CT-001',
          contract_type: 'advertising',
          title: '',
          start_date: '2025-01-01T00:00:00.000Z',
        },
      };
      await runValidators(req, createSubscriberContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('updateSubscriberContractValidators', () => {
    it('deve aceitar atualização parcial válida', async () => {
      const req = {
        body: {
          status: 'active',
          title: 'Novo Título',
        },
      };
      await runValidators(req, updateSubscriberContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar status inválido', async () => {
      const req = { body: { status: 'invalid_status' } };
      await runValidators(req, updateSubscriberContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });

    it('deve aceitar status null (campo opcional no JSON)', async () => {
      const req = { body: { status: null } };
      await runValidators(req, updateSubscriberContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });
  });

  describe('createPublisherContractValidators', () => {
    it('deve aceitar payload válido', async () => {
      const req = {
        body: {
          contract_number: 'PC-001',
          contract_type: 'revenue_share',
          title: 'Contrato Publisher',
          start_date: '2025-01-01T00:00:00.000Z',
          end_date: '2025-12-31T23:59:59.000Z',
        },
      };
      await runValidators(req, createPublisherContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar contract_type inválido', async () => {
      const req = {
        body: {
          contract_number: 'PC-001',
          contract_type: 'invalid',
          title: 'Título',
          start_date: '2025-01-01T00:00:00.000Z',
        },
      };
      await runValidators(req, createPublisherContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });

    it('deve aceitar billing_interval e subscription_amount', async () => {
      const req = {
        body: {
          contract_number: 'PC-002',
          contract_type: 'subscription',
          title: 'Assinatura exibidor',
          start_date: '2025-01-01T00:00:00.000Z',
          subscription_amount: 499.9,
          billing_interval: 'four_month',
        },
      };
      await runValidators(req, createPublisherContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar billing_interval inválido', async () => {
      const req = {
        body: {
          contract_number: 'PC-003',
          contract_type: 'subscription',
          title: 'Título',
          start_date: '2025-01-01T00:00:00.000Z',
          billing_interval: 'weekly',
        },
      };
      await runValidators(req, createPublisherContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('updatePublisherContractValidators', () => {
    it('deve aceitar revenue_share_percentage no intervalo 0-100', async () => {
      const req = { body: { revenue_share_percentage: 50 } };
      await runValidators(req, updatePublisherContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar revenue_share_percentage > 100', async () => {
      const req = { body: { revenue_share_percentage: 150 } };
      await runValidators(req, updatePublisherContractValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });
});
