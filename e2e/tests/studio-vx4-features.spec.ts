import { test, expect } from '../fixtures/auth.fixture';

test.describe('Studio Vx4 — templates e cardápio', () => {
  test('dashboard mostra templates em destaque com preview', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText(/Templates em destaque/i).first()).toBeVisible();
    await expect(adminPage.getByText(/Cardápio digital|Promoção do dia/i).first()).toBeVisible();
  });

  test('admin acede cardápio por cliente', async ({ adminPage }) => {
    await adminPage.goto('/menu-catalog');
    await expect(adminPage).toHaveURL(/\/menu-catalog/);
    await expect(adminPage.getByText(/Cardápio por cliente/i).first()).toBeVisible();
    await expect(adminPage.getByLabel(/Anunciante/i)).toBeVisible();
  });

  test('quick publish preset menu mostra dica de cardápio', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?preset=menu&segment=restaurant&orientation=portrait');
    await expect(adminPage.getByText(/Template visual inteligente/i).first()).toBeVisible();
    await expect(adminPage.getByText(/Cardápio Digital/i).first()).toBeVisible();
  });
});

test.describe('Studio Vx4 — OTA histórico', () => {
  test('admin abre aba histórico OTA', async ({ adminPage }) => {
    await adminPage.goto('/ota-updates/history');
    await expect(adminPage).toHaveURL(/\/ota-updates\/history/);
    await expect(adminPage.getByRole('tab', { name: /Histórico/i })).toBeVisible();
    await expect(adminPage.getByText(/Atualizações OTA/i).first()).toBeVisible();
  });
});
