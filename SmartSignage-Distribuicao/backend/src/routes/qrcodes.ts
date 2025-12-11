/**
 * QRCode Routes - Smart Signage v2.0
 * Rotas para gerenciamento de QR Codes
 */

import { Router } from 'express';
import { QRCodeService } from '../services/qrcodeService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Lazy initialization - só criar quando necessário
function getQRCodeService(): QRCodeService {
  if (!(global as any).qrCodeServiceInstance) {
    (global as any).qrCodeServiceInstance = new QRCodeService();
  }
  return (global as any).qrCodeServiceInstance;
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

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao listar QR Codes', error);
    res.status(500).json({
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

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas', error);
    res.status(500).json({
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

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== parseInt(clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver seus próprios QR Codes'
      });
    }

    const qrCodes = await getQRCodeService().getQRCodesByClient(
      parseInt(clientId),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: qrCodes
    });

  } catch (error: any) {
    await logError('Erro ao buscar QR Codes do cliente', error);
    res.status(500).json({
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

    const qrCodes = await getQRCodeService().getQRCodesByTotem(
      parseInt(totemId),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: qrCodes
    });

  } catch (error: any) {
    await logError('Erro ao buscar QR Codes do totem', error);
    res.status(500).json({
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

    const qrCode = await getQRCodeService().getQRCodeById(parseInt(id));

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR Code não encontrado'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== qrCode.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver seus próprios QR Codes'
      });
    }

    res.json({
      success: true,
      data: qrCode
    });

  } catch (error: any) {
    await logError('Erro ao buscar QR Code', error);
    res.status(500).json({
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

    res.status(201).json({
      success: true,
      message: 'QR Code criado com sucesso',
      data: qrCode
    });

  } catch (error: any) {
    await logError('Erro ao criar QR Code', error);
    res.status(400).json({
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

    if (req.user.role === 'client' && req.user.clientId !== existingQRCode.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode editar seus próprios QR Codes'
      });
    }

    const qrCode = await getQRCodeService().updateQRCode(
      parseInt(id),
      updateData,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'QR Code atualizado com sucesso',
      data: qrCode
    });

  } catch (error: any) {
    await logError('Erro ao atualizar QR Code', error);
    res.status(400).json({
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

    res.json({
      success: true,
      message: 'QR Code removido com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover QR Code', error);
    res.status(400).json({
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
        message: 'Acesso negado: Você só pode ver scans de seus próprios QR Codes'
      });
    }

    const result = await getQRCodeService().getQRCodeScans(
      parseInt(id),
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao buscar scans do QR Code', error);
    res.status(500).json({
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
    res.json({
      success: true,
      message: 'Scan registrado com sucesso',
      content: qrCode.content,
      qrType: qrCode.qrType
    });

  } catch (error: any) {
    await logError('Erro ao registrar scan', error);
    res.status(400).json({
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
        message: 'Acesso negado: Você só pode ver imagens de seus próprios QR Codes'
      });
    }

    // Retornar imagem base64
    res.json({
      success: true,
      data: {
        image: qrCode.qrCodeImage,
        size: qrCode.size,
        format: 'png'
      }
    });

  } catch (error: any) {
    await logError('Erro ao gerar imagem do QR Code', error);
    res.status(500).json({
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

    res.json({
      success: true,
      message: 'QR Code ativado com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao ativar QR Code', error);
    res.status(400).json({
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

    res.json({
      success: true,
      message: 'QR Code desativado com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao desativar QR Code', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao desativar QR Code',
      error: error.message
    });
  }
});

export default router;
