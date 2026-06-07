import express from 'express';
import request from 'supertest';

const mockListProducts = jest.fn();

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../services/menuCatalogService', () => ({
  getMenuCatalogService: () => ({
    listProducts: (...args: unknown[]) => mockListProducts(...args),
  }),
}));

import publishBoardPublicRoutes from '../../../routes/publish-board-public';

describe('publish-board-public routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use('/api/publish-board', publishBoardPublicRoutes);
  });

  beforeEach(() => {
    mockListProducts.mockResolvedValue([
      { productId: 1, name: 'Café', price: 5.5, description: null, isAvailable: true },
      { productId: 2, name: 'Suco', price: 8, description: 'Natural', isAvailable: false },
    ]);
  });

  it('lista produtos disponíveis para cardápio HTML ao vivo', async () => {
    const res = await request(app).get('/api/publish-board/public-menu/7');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Café');
    expect(mockListProducts).toHaveBeenCalledWith(7);
  });

  it('rejeita subscriberId inválido', async () => {
    const res = await request(app).get('/api/publish-board/public-menu/abc');
    expect(res.status).toBe(400);
  });
});
