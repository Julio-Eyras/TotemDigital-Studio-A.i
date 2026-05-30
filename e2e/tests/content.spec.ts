import { test, expect } from '../fixtures/auth.fixture';

test.describe('Conteúdo e operação', () => {
  test('biblioteca de mídia lista ou estado vazio', async ({ adminPage }) => {
    await adminPage.goto('/media');
    await expect(adminPage.getByText(/Biblioteca de Mídia/i).first()).toBeVisible();
    await expect(
      adminPage.getByRole('button', { name: /upload|enviar|nova|adicionar|mídia/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('campanhas — visão global somente leitura', async ({ adminPage }) => {
    await adminPage.goto('/campaigns');
    await expect(adminPage.getByText(/Campanhas/i).first()).toBeVisible();
    await expect(adminPage.getByText(/somente leitura|Anunciantes/i).first()).toBeVisible();
  });

  test('playlists carrega gestão', async ({ adminPage }) => {
    await adminPage.goto('/playlists');
    await expect(adminPage.getByText(/^Playlists$/i).first()).toBeVisible();
  });

  test('SmartvPlayer / totens carrega', async ({ adminPage }) => {
    await adminPage.goto('/players');
    await expect(adminPage.getByText(/SmartvPlayer/i).first()).toBeVisible();
  });

  test('anunciantes carrega listagem', async ({ adminPage }) => {
    await adminPage.goto('/subscribers');
    await expect(adminPage.getByText(/Anunciantes/i).first()).toBeVisible();
  });
});
