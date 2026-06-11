import { test, expect } from '../fixtures/auth.fixture';
import { resetMockMenuCatalog } from '../helpers/mock-api';
import { selectFirstSubscriber } from '../helpers/quick-publish';

test.describe('Onda B — cardápio ao vivo', () => {
  test.beforeEach(() => {
    resetMockMenuCatalog();
  });

  test('modo Criar cardápio informa atualização dinâmica de preços', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=menu&segment=restaurant');
    await selectFirstSubscriber(adminPage);
    await expect(adminPage.getByText(/Preços atualizam na tela automaticamente/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByRole('link', { name: /Cardápio por cliente/i })).toBeVisible();
  });

  test('editar preço no cardápio exibe aviso de atualização ao vivo', async ({ adminPage }) => {
    await adminPage.goto('/menu-catalog');
    const subscriberCombo = adminPage.getByRole('combobox').first();
    await subscriberCombo.click({ timeout: 15_000 });
    await adminPage.getByRole('option', { name: /Anunciante Demo E2E/i }).click();
    await expect(adminPage.getByText(/Café expresso/i).first()).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole('button', { name: /Editar/i }).first().click();
    const editDialog = adminPage.getByRole('dialog', { name: /Editar produto/i });
    await editDialog.getByRole('textbox', { name: /Preço/i }).fill('9.90');
    await editDialog.getByRole('button', { name: /^Salvar$/i }).click();
    await expect(
      adminPage.getByText(/atualizam preços automaticamente.*sem republicar campanha/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Onda C — vídeo IA Premium', () => {
  test('botão Vídeo IA conclui e exibe sucesso (mock completed)', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=promotion&segment=retail');
    await selectFirstSubscriber(adminPage);
    await adminPage.getByRole('button', { name: /Vídeo IA \(Premium\)/i }).click();
    await expect(
      adminPage.getByText(/Vídeo IA gerado e selecionado/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('plano base exibe mensagem Premium ao solicitar vídeo IA', async ({ adminPage }) => {
    await adminPage.route('**/api/subscribers/*/publish-board/*/queue-video-ai', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Geração de vídeo por IA disponível apenas no plano Premium.',
          data: { jobId: '', status: 'failed', premiumRequired: true },
        }),
      });
    });

    await adminPage.goto('/quick-publish?mode=create&preset=ad&segment=retail');
    await selectFirstSubscriber(adminPage);
    await adminPage.getByRole('button', { name: /Vídeo IA \(Premium\)/i }).click();
    await expect(
      adminPage.getByText(/disponível apenas no plano Premium/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
