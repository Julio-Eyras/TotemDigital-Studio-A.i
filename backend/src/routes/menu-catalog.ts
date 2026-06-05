import { Router, type Request } from 'express';

type MenuSubscriberParams = { subscriberId: string };
type MenuProductParams = { subscriberId: string; productId: string };
type MenuProductsQuery = { categoryId?: string };
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { getMenuCatalogService } from '../services/menuCatalogService';
import { logError } from '../utils/loggerHelper';

const router = Router({ mergeParams: true });

router.use(authenticateToken);
router.use(blockClientDataAccess);

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
  async (req: Request<MenuSubscriberParams>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
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
  validate,
  async (req: Request<MenuSubscriberParams, unknown, unknown, MenuProductsQuery>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
      const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
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
  async (req: Request<MenuSubscriberParams>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
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
  async (req: Request<MenuSubscriberParams>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
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
  '/products/:productId',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('productId').isInt({ min: 1 }),
  validate,
  async (req: Request<MenuProductParams>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
      const productId = Number(req.params.productId);
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
  async (req: Request<MenuSubscriberParams>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
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
  async (req: Request<MenuSubscriberParams>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
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
  async (
    req: Request<MenuSubscriberParams> & { user?: { id?: number; userId?: number; role?: string } },
    res
  ) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
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
  async (req: Request<MenuProductParams>, res) => {
    try {
      const subscriberId = Number(req.params.subscriberId);
      const productId = Number(req.params.productId);
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
