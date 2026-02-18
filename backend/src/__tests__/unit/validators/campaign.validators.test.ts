/**
 * Testes unitários - validators de campanha
 */

import { validationResult } from 'express-validator';
import {
  createCampaignValidators,
  updateCampaignValidators,
  campaignFilterValidators,
} from '../../../validators/campaign.validators';
import { runValidators } from '../../helpers/validatorRunner';

describe('campaign.validators', () => {
  describe('createCampaignValidators', () => {
    it('deve aceitar payload mínimo válido (título)', async () => {
      const req = {
        body: {
          title: 'Campanha Teste',
        },
      };
      await runValidators(req, createCampaignValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar título vazio', async () => {
      const req = { body: { title: '' } };
      await runValidators(req, createCampaignValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });

    it('deve rejeitar título com menos de 3 caracteres', async () => {
      const req = { body: { title: 'Ab' } };
      await runValidators(req, createCampaignValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });

    it('deve aceitar datas ISO e status válido', async () => {
      const req = {
        body: {
          title: 'Campanha Completa',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-12-31T23:59:59.000Z',
          status: 'draft',
        },
      };
      await runValidators(req, createCampaignValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar status inválido', async () => {
      const req = { body: { title: 'Campanha', status: 'invalid' } };
      await runValidators(req, createCampaignValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('updateCampaignValidators', () => {
    it('deve aceitar atualização parcial', async () => {
      const req = { body: { title: 'Novo Título', status: 'active' } };
      await runValidators(req, updateCampaignValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar priority fora do intervalo 0-10', async () => {
      const req = { body: { priority: 11 } };
      await runValidators(req, updateCampaignValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('campaignFilterValidators', () => {
    it('deve aceitar query vazia (todos opcionais)', async () => {
      const req = { query: {} };
      await runValidators(req, campaignFilterValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve aceitar subscriberId válido', async () => {
      const req = { query: { subscriberId: '1' } };
      await runValidators(req, campaignFilterValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });
  });
});
