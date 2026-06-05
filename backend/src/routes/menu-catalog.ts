import { Router, type Request } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { getMenuCatalogService } from '../services/menuCatalogService';
import { logError } from '../utils/loggerHelper';
import { assertSubscriberParamAccess } from '../middleware/subscriberParamAccess.middleware';

type MenuSubscriberParams = { subscriberId: string };
type MenuProductParams = { subscriberId: string; productId: string };
type MenuProductsQuery = { categoryId?: string };

function parseSubscriberId(req: { params?: unknown }): number {
  const { subscriberId } = (req.params ?? {}) as MenuSubscriberParams;
  return Number(subscriberId);
}

function parseProductIds(req: { params?: unknown }): { subscriberId: number; productId: number } {
  const params = (req.params ?? {}) as MenuProductParams;
  return {
    subscriberId: Number(params.subscriberId),
    productId: Number(params.productId),
  };
}

function parseCategoryFilter(req: { query?: unknown }): number | undefined {
  const query = (req.query ?? {}) as MenuProductsQuery;
  return query.categoryId ? Number(query.categoryId) : undefined;
}

const router = Router({ mergeParams: true });

router.use(authenticateToken);
router.use(blockClientDataAccess);
router.use(assertSubscriberParamAccess);

const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }
  return next();
};

router.get(
  '/categories',
  param('subscriberId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const data = await getMenuCatalogService().listCategories(subscriberId);
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao listar categorias do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao carregar categorias' });
    }
  }
);

router.get(
  '/products',
  param('subscriberId').isInt({ min: 1 }),
  query('categoryId').optional().isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const categoryId = parseCategoryFilter(req);
      const data = await getMenuCatalogService().listProducts(subscriberId, categoryId);
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao listar produtos do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao carregar produtos' });
    }
  }
);

router.post(
  '/categories',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  body('name').isString().trim().isLength({ min: 1, max: 120 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const data = await getMenuCatalogService().createCategory(
        subscriberId,
        req.body.name,
        req.body.sortOrder ?? 0
      );
      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao criar categoria do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar categoria' });
    }
  }
);

router.post(
  '/products',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  body('name').isString().trim().isLength({ min: 1, max: 160 }),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('price').optional({ nullable: true }).isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ max: 8 }),
  body('mediaId').optional({ nullable: true }).isInt({ min: 1 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isAvailable').optional().isBoolean(),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      if (req.body.categoryId != null) {
        const ok = await getMenuCatalogService().assertCategoryBelongsToSubscriber(
          Number(req.body.categoryId),
          subscriberId
        );
        if (!ok) {
          return res.status(400).json({ success: false, error: 'Categoria inválida para este anunciante' });
        }
      }
      const data = await getMenuCatalogService().createProduct({
        subscriberId,
        categoryId: req.body.categoryId,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        currency: req.body.currency,
        mediaId: req.body.mediaId,
        sortOrder: req.body.sortOrder,
        isAvailable: req.body.isAvailable,
      });
      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao criar produto do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar produto' });
    }
  }
);

router.patch(
  '/categories/:categoryId',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('categoryId').isInt({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const categoryId = Number((req.params as MenuProductParams & { categoryId: string }).categoryId);
      const data = await getMenuCatalogService().updateCategory(categoryId, subscriberId, {
        name: req.body.name,
        sortOrder: req.body.sortOrder,
      });
      if (!data) return res.status(404).json({ success: false, error: 'Categoria não encontrada' });
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao atualizar categoria do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar categoria' });
    }
  }
);

router.delete(
  '/categories/:categoryId',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('categoryId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const categoryId = Number((req.params as { categoryId: string }).categoryId);
      const ok = await getMenuCatalogService().deleteCategory(categoryId, subscriberId);
      if (!ok) return res.status(404).json({ success: false, error: 'Categoria não encontrada' });
      return res.json({ success: true });
    } catch (error: any) {
      await logError('Erro ao remover categoria do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao remover categoria' });
    }
  }
);

router.patch(
  '/products/:productId',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('productId').isInt({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('price').optional({ nullable: true }).isFloat({ min: 0 }),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }),
  body('mediaId').optional({ nullable: true }).isInt({ min: 1 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isAvailable').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  validate,
  async (req, res) => {
    try {
      const { subscriberId, productId } = parseProductIds(req);
      if (req.body.categoryId != null) {
        const ok = await getMenuCatalogService().assertCategoryBelongsToSubscriber(
          Number(req.body.categoryId),
          subscriberId
        );
        if (!ok) {
          return res.status(400).json({ success: false, error: 'Categoria inválida para este anunciante' });
        }
      }
      const data = await getMenuCatalogService().updateProduct(productId, subscriberId, req.body);
      if (!data) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao atualizar produto do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar produto' });
    }
  }
);

router.get(
  '/board-layout',
  param('subscriberId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const data = await getMenuCatalogService().getBoardLayout(subscriberId);
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao carregar layout do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao carregar layout' });
    }
  }
);

router.put(
  '/board-layout',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  body('boardTitle').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('accentColor').optional().isString().isLength({ max: 32 }),
  body('productOrder').optional().isArray(),
  body('productOrder.*').optional().isInt({ min: 1 }),
  body('showPrices').optional().isBoolean(),
  validate,
  async (req, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const current = await getMenuCatalogService().getBoardLayout(subscriberId);
      const data = await getMenuCatalogService().saveBoardLayout({
        subscriberId,
        boardTitle: req.body.boardTitle ?? current.boardTitle,
        accentColor: req.body.accentColor ?? current.accentColor,
        productOrder: Array.isArray(req.body.productOrder)
          ? req.body.productOrder.map(Number).filter((n: number) => n > 0)
          : current.productOrder,
        showPrices: req.body.showPrices ?? current.showPrices,
      });
      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro ao salvar layout do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao salvar layout' });
    }
  }
);

router.post(
  '/render-board',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  validate,
  async (req: Request & { user?: { id?: number; userId?: number; role?: string } }, res) => {
    try {
      const subscriberId = parseSubscriberId(req);
      const role = String(req.user?.role || '');
      const isAdmin = ['admin', 'admin_sql', 'owner_system'].includes(role);
      const data = await getMenuCatalogService().renderBoardToMedia(
        subscriberId,
        Number(req.user?.id || req.user?.userId || 0),
        isAdmin
      );
      return res.status(201).json({
        success: true,
        message: 'Mídia do cardápio gerada com sucesso',
        data,
      });
    } catch (error: any) {
      await logError('Erro ao gerar mídia do cardápio', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao gerar mídia do cardápio',
      });
    }
  }
);

router.delete(
  '/products/:productId',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('productId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const { subscriberId, productId } = parseProductIds(req);
      const ok = await getMenuCatalogService().deleteProduct(productId, subscriberId);
      if (!ok) return res.status(404).json({ success: false, error: 'Produto não encontrado' });
      return res.json({ success: true });
    } catch (error: any) {
      await logError('Erro ao remover produto do cardápio', error);
      return res.status(500).json({ success: false, error: 'Erro ao remover produto' });
    }
  }
);

export default router;
