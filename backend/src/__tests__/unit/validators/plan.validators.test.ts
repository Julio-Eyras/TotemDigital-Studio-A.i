/**
 * Testes unitários - validators de plano
 */

import { validationResult } from 'express-validator';
import {
  planLimitsValidators,
  storageValidators,
  totemAccessValidators,
} from '../../../validators/plan.validators';
import { runValidators } from '../../helpers/validatorRunner';

describe('plan.validators', () => {
  describe('planLimitsValidators', () => {
    it('deve aceitar resourceType válido (media, playlist, campaign)', async () => {
      for (const resourceType of ['media', 'playlist', 'campaign']) {
        const req = { query: { resourceType } };
        await runValidators(req, planLimitsValidators);
        const result = validationResult(req as any);
        expect(result.isEmpty()).toBe(true);
      }
    });

    it('deve rejeitar resourceType inválido', async () => {
      const req = { query: { resourceType: 'invalid' } };
      await runValidators(req, planLimitsValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
      expect(result.array().length).toBeGreaterThan(0);
    });
  });

  describe('storageValidators', () => {
    it('deve aceitar fileSizeBytes inteiro >= 0', async () => {
      const req = { query: { fileSizeBytes: '1024' } };
      await runValidators(req, storageValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve aceitar fileSizeBytes zero', async () => {
      const req = { query: { fileSizeBytes: '0' } };
      await runValidators(req, storageValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar fileSizeBytes negativo', async () => {
      const req = { query: { fileSizeBytes: '-1' } };
      await runValidators(req, storageValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('totemAccessValidators', () => {
    it('deve aceitar totemId inteiro >= 1', async () => {
      const req = { query: { totemId: '1' } };
      await runValidators(req, totemAccessValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar totemId zero', async () => {
      const req = { query: { totemId: '0' } };
      await runValidators(req, totemAccessValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });
});
