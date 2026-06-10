import { MenuCatalogTriggerService } from '../../../services/menuCatalogTriggerService';

describe('menuCatalogTriggerService', () => {
  const service = new MenuCatalogTriggerService();

  afterEach(() => {
    delete process.env.MENU_LIVE_REFRESH_SECONDS;
  });

  it('usa 30s por padrão e limita intervalo entre 5 e 300', () => {
    expect(service.getLiveRefreshSeconds()).toBe(30);
    process.env.MENU_LIVE_REFRESH_SECONDS = '2';
    expect(service.getLiveRefreshSeconds()).toBe(5);
    process.env.MENU_LIVE_REFRESH_SECONDS = '999';
    expect(service.getLiveRefreshSeconds()).toBe(300);
    process.env.MENU_LIVE_REFRESH_SECONDS = '45';
    expect(service.getLiveRefreshSeconds()).toBe(45);
  });
});
