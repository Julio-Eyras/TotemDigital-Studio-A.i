import { test, expect } from '../fixtures/auth.fixture';

test.describe('Studio Vx4 — templates e cardápio', () => {
  test('dashboard mostra templates em destaque com preview', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText(/Templates em destaque/i).first()).toBeVisible();
    await expect(adminPage.getByText(/Cardápio digital|Promoção do dia/i).first()).toBeVisible();
  });

  test('dashboard mostra checklist de onboarding ou conteúdo comercial', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');
    const checklist = adminPage.getByText(/Primeiros passos|anunciante|publicação/i).first();
    const templates = adminPage.getByText(/Templates em destaque/i).first();
    await expect(checklist.or(templates)).toBeVisible();
  });

  test('dashboard abre estúdio visual ao clicar template em destaque', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(/Promoção do dia/i).first().click();
    await expect(adminPage).toHaveURL(/\/publish-board\?.*preset=promotion/);
    await expect(adminPage.getByText(/Estúdio de publicação visual/i).first()).toBeVisible();
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

test.describe('Studio Vx5 — estúdio visual e templates admin', () => {
  test('admin acede estúdio visual com abas de templates', async ({ adminPage }) => {
    await adminPage.goto('/publish-board?preset=promotion&segment=retail');
    await expect(adminPage).toHaveURL(/\/publish-board/);
    await expect(adminPage.getByText(/Estúdio de publicação visual/i).first()).toBeVisible();
    await expect(adminPage.getByRole('tab', { name: /Promoção|Cardápio Digital/i }).first()).toBeVisible();
  });

  test('estúdio exibe abas Comunicado e Institucional', async ({ adminPage }) => {
    await adminPage.goto('/publish-board?preset=announcement&segment=church');
    await expect(adminPage.getByRole('tab', { name: /Comunicado/i })).toBeVisible();
    await adminPage.getByRole('tab', { name: /Institucional/i }).click();
    await expect(adminPage).toHaveURL(/preset=institutional/);
    await expect(adminPage.getByText(/Institucional/i).first()).toBeVisible();
  });

  test('estúdio promoção mostra campos de oferta após escolher anunciante', async ({ adminPage }) => {
    await adminPage.goto('/publish-board?preset=promotion&segment=retail');
    await adminPage.getByLabel(/Anunciante/i).click();
    await adminPage.getByRole('option').first().click();
    await expect(adminPage.getByLabel(/Chamada principal|Título do quadro/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByLabel(/Texto da oferta|Preço em destaque/i).first()).toBeVisible();
  });

  test('admin vê estúdio do cardápio após escolher anunciante', async ({ adminPage }) => {
    await adminPage.goto('/publish-board?preset=menu&segment=restaurant');
    await adminPage.getByLabel(/Anunciante/i).click();
    await adminPage.getByRole('option').first().click();
    await expect(adminPage.getByText(/Gerar mídia e publicar/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('admin acede templates de publicação', async ({ adminPage }) => {
    await adminPage.goto('/publish-templates-admin');
    await expect(adminPage).toHaveURL(/\/publish-templates-admin/);
    await expect(adminPage.getByText(/Templates de publicação/i).first()).toBeVisible();
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
