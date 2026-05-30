import { test, expect } from '../fixtures/auth.fixture';

/**
 * Regressão: admin via menu Configurações → OTA não deve voltar ao dashboard.
 * Bug corrigido em rolePermissions (admin ausente em /ota-updates).
 */
test.describe('OTA Update — regressão de permissões', () => {
  test('admin navega direto para /ota-updates', async ({ adminPage }) => {
    await adminPage.goto('/ota-updates');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage).toHaveURL(/\/ota-updates/);
    await expect(adminPage.getByText(/Atualizações OTA/i).first()).toBeVisible();
    await expect(adminPage.getByRole('button', { name: /Nova Atualização/i })).toBeVisible();
  });

  test('admin vê estatísticas OTA na página', async ({ adminPage }) => {
    await adminPage.goto('/ota-updates');
    await expect(adminPage.getByText(/Atualizações OTA/i).first()).toBeVisible();
    await expect(adminPage.getByText(/Atualizações Ativas|Totens Atualizados/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
