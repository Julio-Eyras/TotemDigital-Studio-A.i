/**
 * Testes para TotemPlaylistMixService
 */

import { TotemPlaylistMixService } from '../../services/totemPlaylistMixService';

describe('TotemPlaylistMixService', () => {
  let service: TotemPlaylistMixService;

  beforeEach(() => {
    service = new TotemPlaylistMixService();
  });

  describe('getDefaultMixRule', () => {
    it('deve retornar regra padrão quando não há regra específica', async () => {
      // Como getDefaultMixRule é privado, testamos via comportamento público
      // Testamos getMixRuleForTotem com totem inexistente
      const rule = await service.getMixRuleForTotem(999999);
      
      expect(rule).toBeTruthy();
      expect(rule?.rule_type).toBe('systematic');
      expect(rule?.name).toBe('Regra Padrão');
      expect(rule?.ai_enabled).toBe(false);
    });
  });

  describe('validateMixRule', () => {
    it('deve validar regra com dados corretos', async () => {
      const validRule = {
        name: 'Test Rule',
        rule_type: 'systematic' as const,
        priority_weight: 1.0,
        time_weight: 1.0,
        tag_weight: 0.5,
        subscriber_weight: 0.5,
      };

      const result = await service.validateMixRule(validRule);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('deve rejeitar regra sem nome', async () => {
      const invalidRule = {
        name: '',
        rule_type: 'systematic' as const,
      };

      const result = await service.validateMixRule(invalidRule);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Nome'))).toBe(true);
    });

    it('deve rejeitar pesos inválidos', async () => {
      const invalidRule = {
        name: 'Test Rule',
        rule_type: 'systematic' as const,
        priority_weight: 15, // Fora do range 0-10
      };

      const result = await service.validateMixRule(invalidRule);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('peso') || e.includes('weight'))).toBe(true);
    });

    it('deve rejeitar max_items_per_playlist inválido', async () => {
      const invalidRule = {
        name: 'Test Rule',
        rule_type: 'systematic' as const,
        max_items_per_playlist: 2000, // Maior que 1000
      };

      const result = await service.validateMixRule(invalidRule);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('max_items_per_playlist'))).toBe(true);
    });
  });

  describe('getMixRuleForTotem', () => {
    it('deve retornar regra padrão quando totem não existe', async () => {
      const rule = await service.getMixRuleForTotem(999999);
      
      expect(rule).toBeTruthy();
      expect(rule?.rule_type).toBeDefined();
      expect(rule?.name).toBeDefined();
    });
  });

  describe('getAIContextForTotem', () => {
    it('deve retornar null quando totem não existe', async () => {
      const context = await service.getAIContextForTotem(999999);
      
      expect(context).toBeNull();
    });
  });

  describe('getCurrentMix', () => {
    it('deve retornar null quando totem não existe', async () => {
      const mix = await service.getCurrentMix(999999);
      
      expect(mix).toBeNull();
    });
  });

  // Testes de integração podem ser adicionados aqui quando necessário
  // Por enquanto, focamos em testes unitários básicos
});

