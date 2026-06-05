import express from 'express';
import request from 'supertest';

const mockListCategories = jest.fn();
const mockListProducts = jest.fn();
const mockCreateCategory = jest.fn();
const mockUpdateCategory = jest.fn();
const mockDeleteCategory = jest.fn();

jest.mock('../../../middleware/auth.middleware', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  authorizeRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../middleware/operatorProtection.middleware', () => ({
  blockClientDataAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../middleware/subscriberParamAccess.middleware', () => ({
  assertSubscriberParamAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../services/menuCatalogService', () => ({
  getMenuCatalogService: () => ({
    listCategories: (...args: unknown[]) => mockListCategories(...args),
    listProducts: (...args: unknown[]) => mockListProducts(...args),
    createCategory: (...args: unknown[]) => mockCreateCategory(...args),
    updateCategory: (...args: unknown[]) => mockUpdateCategory(...args),
    deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
    assertCategoryBelongsToSubscriber: jest.fn().mockResolvedValue(true),
  }),
}));

import menuCatalogRoutes from '../../../routes/menu-catalog';

describe('menu-catalog routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/subscribers/:subscriberId/menu-catalog', menuCatalogRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListCategories.mockResolvedValue([{ categoryId: 1, name: 'Bebidas' }]);
    mockListProducts.mockResolvedValue([]);
    mockUpdateCategory.mockResolvedValue({ categoryId: 1, name: 'Drinks' });
    mockDeleteCategory.mockResolvedValue(true);
  });

  it('lista categorias do anunciante', async () => {
    const res = await request(app).get('/api/subscribers/1/menu-catalog/categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockListCategories).toHaveBeenCalledWith(1);
  });

  it('atualiza categoria', async () => {
    const res = await request(app)
      .patch('/api/subscribers/1/menu-catalog/categories/1')
      .send({ name: 'Drinks' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Drinks');
  });

  it('remove categoria', async () => {
    const res = await request(app).delete('/api/subscribers/1/menu-catalog/categories/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
