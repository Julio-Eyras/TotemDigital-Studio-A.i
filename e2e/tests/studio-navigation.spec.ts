import { test, expect } from '../fixtures/auth.fixture';
import { STUDIO_ADMIN_ROUTES, URL_ONLY_ROUTES } from '../helpers/routes';

test.describe('Navegação Studio (admin)', () => {
  for (const route of STUDIO_ADMIN_ROUTES) {
    test(`admin acede ${route.path}`, async ({ adminPage }) => {
      await adminPage.goto(route.path);
      await adminPage.waitForLoadState('domcontentloaded');

      const currentUrl = adminPage.url();
      if (route.allowDashboardRedirect && /\/dashboard/.test(currentUrl)) {
        await expect(adminPage.getByText(/Dashboard/i).first()).toBeVisible();
        return;
      }

      expect(currentUrl).toMatch(new RegExp(route.path.replace('/', '\\/')));
      expect(currentUrl).not.toMatch(/\/login$/);

      if (URL_ONLY_ROUTES.has(route.path)) {
        await expect(adminPage.locator('#root')).toBeVisible();
        return;
      }

      await expect(adminPage.locator('body')).toBeVisible();
      await expect(adminPage.getByText(route.heading).first()).toBeVisible({ timeout: 25_000 });
    });
  }
});
