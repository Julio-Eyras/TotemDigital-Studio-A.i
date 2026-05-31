import { Router } from 'express';
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
  async (req, res) => {
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
  async (req, res) => {
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
  async (req, res) => {
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
  async (req, res) => {
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
  async (req, res) => {
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

router.delete(
  '/products/:productId',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing', 'editoracao']),
  param('subscriberId').isInt({ min: 1 }),
  param('productId').isInt({ min: 1 }),
  validate,
  async (req, res) => {
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
