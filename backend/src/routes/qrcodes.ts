/**
 * QRCode Routes - Smart Signage v2.0
 * Rotas para gerenciamento de QR Codes
 */

import { Router } from 'express';
import { getQRCodeService } from '../services/qrcodeService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';
import { assertTenantClientParamAccess } from '../utils/tenantClientAccess';
import { assertTotemReadAccess } from '../utils/totemReadAccess';

const router = Router();

/** `clientId` no modelo de QR é o subscriber_id da campanha (compat.). */
async function assertQRCodeSubscriberAccess(
  req: any,
  res: any,
  qrCode: { clientId?: number | null } | null
): Promise<boolean> {
  if (!qrCode) {
    res.status(404).json({ success: false, message: 'QR Code não encontrado' });
    return false;
  }
  const sid = qrCode.clientId != null ? Number(qrCode.clientId) : NaN;
  if (!Number.isFinite(sid) || sid < 1) {
    res.status(400).json({ success: false, message: 'QR Code sem assinante associado' });
    return false;
  }
  try {
    await assertTenantClientParamAccess(req, sid);
  } catch (e: any) {
    if (e?.statusCode === 403) {
      res.status(403).json({ success: false, message: e.message || 'Acesso negado' });
      return false;
    }
    throw e;
  }
  return true;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route GET /api/qrcodes
 * @desc Lista QR Codes com paginação e filtros
 * @access Private (Admin, Manager, Client)
 */
router.get('/', async (req: any, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      clientId,
      totemId,
      campaignId,
      qrType,
      isActive,
      search
    } = req.query;

    // Aplicar filtro de cliente se for Client
    const filters: any = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      totemId: totemId ? parseInt(totemId as string) : undefined,
      campaignId: campaignId ? parseInt(campaignId as string) : undefined,
      qrType: qrType as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string
    };

    const result = await getQRCodeService().getQRCodes(
      parseInt(page as string),
      parseInt(limit as string),
      filters
    );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao listar QR Codes', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message || 'Erro desconhecido'
    });
  }
});

/**
 * @route GET /api/qrcodes/stats
 * @desc Busca estatísticas gerais de QR Codes
 * @access Private (Admin, Manager)
 */
router.get('/stats', authorizeRole(['admin', 'gerente_marketing']), async (_req, res) => {
  try {
    const stats = await getQRCodeService().getQRCodeStats();

    return res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/qrcodes/client/:clientId
 * @desc Lista QR Codes de um cliente específico
 * @access Private (Admin, Manager, Client)
 */
router.get('/client/:clientId', async (req: any, res) => {
  try {
    const { clientId } = req.params;
    const { limit = 50 } = req.query;

    const sid = parseInt(clientId, 10);
    if (Number.isNaN(sid) || sid < 1) {
      return res.status(400).json({
        success: false,
        message: 'ID de assinante inválido'
      });
    }

    await assertTenantClientParamAccess(req, sid);

    const qrCodes = await getQRCodeService().getQRCodesByClient(
      sid,
      parseInt(String(limit), 10)
    );

    return res.json({
      success: true,
      data: qrCodes
    });

  } catch (error: any) {
    if (error?.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message || 'Acesso negado'
      });
    }
    await logError('Erro ao buscar QR Codes do cliente', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/qrcodes/totem/:totemId
 * @desc Lista QR Codes de um totem específico
 * @access Private (Admin, Manager, Client)
 */
router.get('/totem/:totemId', async (req: any, res) => {
  try {
    const { totemId } = req.params;
    const { limit = 50 } = req.query;

    const tid = parseInt(totemId, 10);
    if (Number.isNaN(tid) || tid < 1) {
      return res.status(400).json({
        success: false,
        message: 'ID de totem inválido'
      });
    }

    await assertTotemReadAccess(req, tid);

    const qrCodes = await getQRCodeService().getQRCodesByTotem(
      tid,
      parseInt(String(limit), 10)
    );

    return res.json({
      success: true,
      data: qrCodes
    });

  } catch (error: any) {
    if (error?.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message || 'Acesso negado'
      });
    }
    if (error?.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message || 'Não encontrado'
      });
    }
    await logError('Erro ao buscar QR Codes do totem', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/qrcodes/:id
 * @desc Busca QR Code por ID
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const qrCode = await getQRCodeService().getQRCodeById(parseInt(id, 10));

    if (!(await assertQRCodeSubscriberAccess(req, res, qrCode))) {
      return;
    }
    if (!qrCode) {
      return;
    }

    return res.json({
      success: true,
      data: qrCode
    });

  } catch (error: any) {
    await logError('Erro ao buscar QR Code', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/qrcodes
 * @desc Cria novo QR Code
 * @access Private (Admin, Manager, Client)
 */
router.post('/', async (req: any, res) => {
  try {
    const qrCodeData = req.body;

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== qrCodeData.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode criar QR Codes para seu próprio cliente'
      });
    }

    const qrCode = await getQRCodeService().createQRCode(qrCodeData, req.user.userId);

    return res.status(201).json({
      success: true,
      message: 'QR Code criado com sucesso',
      data: qrCode
    });

  } catch (error: any) {
    await logError('Erro ao criar QR Code', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar QR Code',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/qrcodes/:id
 * @desc Atualiza QR Code
 * @access Private (Admin, Manager, Client)
 */
router.put('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar se QR Code existe e permissão
    const existingQRCode = await getQRCodeService().getQRCodeById(parseInt(id));
    if (!existingQRCode) {
      return res.status(404).json({
        success: false,
        message: 'QR Code não encontrado'
      });
    }

    if (!(await assertQRCodeSubscriberAccess(req, res, existingQRCode))) {
      return;
    }

    const qrCode = await getQRCodeService().updateQRCode(
      parseInt(id),
      updateData,
      req.user.userId
    );

    return res.json({
      success: true,
      message: 'QR Code atualizado com sucesso',
      data: qrCode
    });

  } catch (error: any) {
    await logError('Erro ao atualizar QR Code', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar QR Code',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/qrcodes/:id
 * @desc Remove QR Code
 * @access Private (Admin, Manager)
 */
router.delete('/:id', authorizeRole(['admin', 'gerente_marketing']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getQRCodeService().deleteQRCode(parseInt(id), req.user.userId);

    return res.json({
      success: true,
      message: 'QR Code removido com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover QR Code', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover QR Code',
      error: error.message
    });
  }
});

/**
 * @route GET /api/qrcodes/:id/scans
 * @desc Lista scans de um QR Code
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id/scans', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verificar se QR Code existe e permissão
    const qrCode = await getQRCodeService().getQRCodeById(parseInt(id, 10));
    if (!(await assertQRCodeSubscriberAccess(req, res, qrCode))) {
      return;
    }
    if (!qrCode) {
      return;
    }

    const result = await getQRCodeService().getQRCodeScans(
      parseInt(id),
      parseInt(page as string),
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao buscar scans do QR Code', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/qrcodes/:id/scan
 * @desc Registra scan do QR Code (público)
 * @access Public
 */
router.post('/:id/scan', async (req, res) => {
  try {
    const { id } = req.params;
    const scanData = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      location: req.body.location,
      deviceInfo: req.body.deviceInfo
    };

    await getQRCodeService().recordScan(parseInt(id), scanData);

    // Buscar QR Code para redirecionamento
    const qrCode = await getQRCodeService().getQRCodeById(parseInt(id));
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR Code não encontrado'
      });
    }

    // Se tem URL de redirecionamento, usar ela
    if (qrCode.redirectUrl) {
      return res.json({
        success: true,
        message: 'Scan registrado com sucesso',
        redirectUrl: qrCode.redirectUrl
      });
    }

    // Senão, retornar conteúdo do QR Code
    return res.json({
      success: true,
      message: 'Scan registrado com sucesso',
      content: qrCode.content,
      qrType: qrCode.qrType
    });

  } catch (error: any) {
    await logError('Erro ao registrar scan', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao registrar scan',
      error: error.message
    });
  }
});

/**
 * @route GET /api/qrcodes/:id/image
 * @desc Gera imagem do QR Code
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id/image', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se QR Code existe e permissão
    const qrCode = await getQRCodeService().getQRCodeById(parseInt(id, 10));
    if (!(await assertQRCodeSubscriberAccess(req, res, qrCode))) {
      return;
    }
    if (!qrCode) {
      return;
    }

    // Retornar imagem base64
    return res.json({
      success: true,
      data: {
        image: qrCode.qrCodeImage,
        size: qrCode.size,
        format: 'png'
      }
    });

  } catch (error: any) {
    await logError('Erro ao gerar imagem do QR Code', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/qrcodes/:id/activate
 * @desc Ativa QR Code
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/activate', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se QR Code existe e permissão
    const qrCode = await getQRCodeService().getQRCodeById(parseInt(id));
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR Code não encontrado'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== qrCode.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ativar seus próprios QR Codes'
      });
    }

    await getQRCodeService().updateQRCode(parseInt(id), { isActive: true }, req.user.userId);

    return res.json({
      success: true,
      message: 'QR Code ativado com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao ativar QR Code', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao ativar QR Code',
      error: error.message
    });
  }
});

/**
 * @route POST /api/qrcodes/:id/deactivate
 * @desc Desativa QR Code
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/deactivate', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se QR Code existe e permissão
    const qrCode = await getQRCodeService().getQRCodeById(parseInt(id));
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR Code não encontrado'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== qrCode.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode desativar seus próprios QR Codes'
      });
    }

    await getQRCodeService().updateQRCode(parseInt(id), { isActive: false }, req.user.userId);

    return res.json({
      success: true,
      message: 'QR Code desativado com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao desativar QR Code', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao desativar QR Code',
      error: error.message
    });
  }
});

export default router;
