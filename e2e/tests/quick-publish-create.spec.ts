import { test, expect } from '../fixtures/auth.fixture';
import { selectFirstSubscriber } from '../helpers/quick-publish';

test.describe('Publicar em Tela — Opção C (Rápido / Criar)', () => {
  test('exibe abas Rápido e Criar', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish');
    await expect(adminPage.getByRole('tab', { name: /Rápido/i })).toBeVisible();
    await expect(adminPage.getByRole('tab', { name: /Criar/i })).toBeVisible();
  });

  test('modo Rápido mostra upload de mídia', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=quick');
    await expect(adminPage.getByText(/Enviar nova mídia/i).first()).toBeVisible();
    await expect(adminPage.getByText(/Template visual inteligente/i).first()).toBeVisible();
  });

  test('modo Criar mostra painel de animação HTML', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=promotion&segment=retail');
    await selectFirstSubscriber(adminPage);
    await expect(adminPage.getByText(/Pré-visualização animada/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByRole('button', { name: /Gerar animação HTML/i })).toBeVisible();
  });

  test('publish-board redireciona para modo Criar', async ({ adminPage }) => {
    await adminPage.goto('/publish-board?preset=promotion&segment=retail');
    await expect(adminPage).toHaveURL(/\/quick-publish\?.*mode=create/);
    await expect(adminPage.getByRole('tab', { name: /Criar/i })).toBeVisible();
  });

  test('modo Criar promoção exibe campos após escolher anunciante', async ({ adminPage }) => {
    await adminPage.goto('/quick-publish?mode=create&preset=promotion&segment=retail');
    await selectFirstSubscriber(adminPage);
    await expect(adminPage.getByLabel(/Chamada principal|Título do quadro/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByRole('button', { name: /Gerar animação HTML/i })).toBeVisible();
  });
});
