import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getPublishTemplateService } from '../services/publishTemplateService';
import { logError } from '../utils/loggerHelper';

const router = Router();

router.get('/featured', authenticateToken, async (_req, res) => {
  try {
    const data = await getPublishTemplateService().listFeatured();
    return res.json({ success: true, data });
  } catch (error: any) {
    await logError('Erro ao listar templates em destaque', error);
    return res.status(500).json({ success: false, error: 'Erro ao carregar templates' });
  }
});

router.get('/', authenticateToken, async (_req, res) => {
  try {
    const data = await getPublishTemplateService().listAll();
    return res.json({ success: true, data });
  } catch (error: any) {
    await logError('Erro ao listar templates de publicação', error);
    return res.status(500).json({ success: false, error: 'Erro ao carregar templates' });
  }
});

export default router;
