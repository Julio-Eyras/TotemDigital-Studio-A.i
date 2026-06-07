import { Page } from '@playwright/test';

/** Seleciona o primeiro anunciante no fluxo Publicar em Tela. */
export async function selectFirstSubscriber(page: Page): Promise<void> {
  // MUI Select nem sempre expõe name no combobox; o primeiro habilitado é "Anunciante".
  const combo = page.getByRole('combobox').first();
  await combo.click({ timeout: 15_000 });
  await page.getByRole('listbox').getByRole('option').first().click();
}
