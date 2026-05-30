import { test, expect, E2E_USERNAME, E2E_PASSWORD } from '../fixtures/auth.fixture';
import { disableMockSessionSeed } from '../helpers/mock-api';

const usernameInput = (page: import('@playwright/test').Page) => page.locator('input[name="username"]');
const passwordInput = (page: import('@playwright/test').Page) => page.locator('input[name="password"]');

test.describe('Autenticação', () => {
  test('página de login carrega', async ({ page }) => {
    await page.goto('/login');
    await expect(usernameInput(page)).toBeVisible({ timeout: 30_000 });
    await expect(passwordInput(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('login inválido mostra erro', async ({ page }) => {
    await page.goto('/login');
    await usernameInput(page).fill('invalido');
    await passwordInput(page).fill('senhaerrada');
    await passwordInput(page).press('Enter');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByText(/inválid|incorret|erro|credencial|401/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('login admin redireciona ao dashboard', async ({ page }) => {
    await page.goto('/login');
    await usernameInput(page).fill(E2E_USERNAME);
    await passwordInput(page).fill(E2E_PASSWORD);
    await passwordInput(page).press('Enter');
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible();
  });

  test('logout limpa sessão', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await disableMockSessionSeed(adminPage);
    await adminPage.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.waitForURL('**/login', { timeout: 15_000 });
    const token = await adminPage.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeFalsy();
  });
});
