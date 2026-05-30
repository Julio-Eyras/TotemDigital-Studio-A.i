import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { installMockApiOnContext, seedMockSession } from '../helpers/mock-api';

export const E2E_USERNAME = process.env.E2E_USERNAME || 'totemdigital.admin';
export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'admin123';

export function isMockMode(): boolean {
  return process.env.E2E_MOCK_API !== '0';
}

export async function loginAsAdmin(page: Page): Promise<void> {
  if (isMockMode()) {
    await seedMockSession(page);
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    return;
  }

  await page.goto('/login');
  await page.getByLabel(/nome de usuário/i).fill(E2E_USERNAME);
  await page.locator('input[name="password"]').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function assertAuthenticated(page: Page): Promise<void> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  const userRaw = await page.evaluate(() => localStorage.getItem('user'));
  expect(userRaw).toBeTruthy();
  const user = JSON.parse(userRaw!);
  expect(['admin', 'owner_system', 'admin_sql']).toContain(user.role);
}

type AuthFixtures = {
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  context: async ({ context }, use) => {
    if (isMockMode()) {
      await installMockApiOnContext(context);
    }
    await use(context);
  },
  adminPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await assertAuthenticated(page);
    await use(page);
  },
});

export { expect };
