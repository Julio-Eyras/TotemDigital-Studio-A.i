import { test, expect } from '../fixtures/auth.fixture';
import { selectFirstSubscriber } from '../helpers/quick-publish';

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

  test('dashboard abre modo Criar ao clicar template em destaque', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(/Promoção do dia/i).first().click();
    await expect(adminPage).toHaveURL(/\/quick-publish\?.*mode=create.*preset=promotion/);
    await expect(adminPage.getByRole('tab', { name: /Criar/i })).toBeVisible();
  });

  test('admin acede cardápio por cliente', async ({ adminPage }) => {
    await adminPage.goto('/menu-catalog');
    await expect(adminPage).toHaveURL(/\/menu-catalog/);
    await expect(adminPage.getByText(/Cardápio por cliente/i).first()).toBeVisible();
    await expect(adminPage.getByLabel(/Anunciante/i)).toBeVisible();
  });

  test('quick publish modo rápido preset menu mostra templates', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=quick&preset=menu&segment=restaurant&orientation=portrait');
    await expect(adminPage.getByText(/Template visual inteligente/i).first()).toBeVisible();
    await expect(adminPage.getByText(/Cardápio Digital/i).first()).toBeVisible();
  });
});

test.describe('Studio Vx5 — modo Criar e templates admin', () => {
  test('admin acede modo Criar com abas de templates', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=promotion&segment=retail');
    await expect(adminPage).toHaveURL(/mode=create/);
    await expect(adminPage.getByRole('tab', { name: /Criar/i })).toBeVisible();
    await expect(adminPage.getByRole('tab', { name: /Promoção|Cardápio Digital/i }).first()).toBeVisible();
  });

  test('modo Criar exibe abas Comunicado e Institucional', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=announcement&segment=church');
    await expect(adminPage.getByRole('tab', { name: /Comunicado/i })).toBeVisible();
    await adminPage.getByRole('tab', { name: /Institucional/i }).click();
    await expect(adminPage).toHaveURL(/preset=institutional/);
    await expect(adminPage.getByText(/Institucional/i).first()).toBeVisible();
  });

  test('modo Criar promoção mostra campos de oferta após escolher anunciante', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=promotion&segment=retail');
    await selectFirstSubscriber(adminPage);
    await expect(adminPage.getByLabel(/Chamada principal|Título do quadro/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByLabel(/Texto da oferta|Preço em destaque/i).first()).toBeVisible();
  });

  test('admin vê cardápio no modo Criar após escolher anunciante', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=menu&segment=restaurant');
    await selectFirstSubscriber(adminPage);
    await expect(adminPage.getByRole('button', { name: /Gerar animação HTML/i })).toBeVisible({
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
