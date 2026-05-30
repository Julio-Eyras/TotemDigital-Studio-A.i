import { test, expect, isMockMode } from '../fixtures/auth.fixture';

test.describe('Dashboard Studio', () => {
  test('dashboard comercial exibe resumo', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByText(/Dashboard Comercial|Dashboard/i).first()).toBeVisible();
    await expect(adminPage.getByRole('button', { name: /atualizar|refresh/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('ui-context público responde (API)', async ({ request }) => {
    test.skip(isMockMode(), 'Requer backend real (modo full)');
    const backendPort = process.env.E2E_BACKEND_PORT || '3000';
    const res = await request.get(`http://127.0.0.1:${backendPort}/api/dashboard/ui-context`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.totemDigitalCompact === true || body.data?.totemDigitalCompact === true).toBeTruthy();
  });
});
