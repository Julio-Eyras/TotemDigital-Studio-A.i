import { Router, Response } from 'express';
import { getMediaService } from '../services/mediaService';
import { StorageService } from '../services/storageService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { subscriberIsolationMiddleware } from '../middleware/subscriberIsolation.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param } from 'express-validator';
import { logError, logDebug, logWarnSync, sanitizeForLogging } from '../utils/loggerHelper';
import { uploadLimiter } from '../middleware/security.middleware';
import { getSubscriberService } from '../services/subscriberService';
import { determineSubscriberId } from '../utils/subscriberHelper';
import { 
  paginationValidators, 
  searchValidators, 
  sortValidators, 
  dateRangeValidators,
  idParamValidatorDefault,
  // subscriberIdValidators removido - não utilizado
} from '../validators/common.validators';
import { mediaFilterValidators, updateMediaValidators } from '../validators/media.validators';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getMediaConfig, getAllowedMimeTypes, getStoragePath } from '../config/mediaConfig';

const router = Router();

// GET thumbnail SEM auth - <img src="/api/media/:id/thumbnail"> não envia Authorization
router.get('/:id/thumbnail',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const thumbnail = await getMediaService().getThumbnail(mediaId);
      if (!thumbnail) {
        return res.status(404).json({ error: 'Thumbnail não encontrado' });
      }
      return res.sendFile(thumbnail);
    } catch (_error: any) {
      return res.status(500).json({ error: 'Erro ao obter thumbnail' });
    }
  }
);

// Middleware de autenticação para todas as rotas (thumbnail acima não exige auth)
router.use(authMiddleware);

// Aplicar bloqueio de dados de clientes para OPERATOR
router.use(blockClientDataAccess);

// Aplicar isolamento de dados por subscriber
router.use(subscriberIsolationMiddleware);

// Função para criar configuração dinâmica do multer
function createMulterConfig() {
  const config = getMediaConfig();
  const allowedMimeTypes = getAllowedMimeTypes();
  const storagePath = getStoragePath();

  // Criar diretório se não existir (com tratamento de erro de permissão)
  // Se não conseguir criar, usar valores padrão e tentar novamente na próxima requisição
  if (!fs.existsSync(storagePath)) {
    try {
      fs.mkdirSync(storagePath, { recursive: true });
      // Diretório criado - log será feito pelo StorageService
    } catch (error: any) {
      if (error.code === 'EACCES') {
        // Log será feito pelo StorageService
        // Não falhar aqui - tentar usar o diretório mesmo assim (pode já existir)
        // Se realmente não existir, o erro será capturado na verificação de escrita abaixo
      } else {
        // Log será feito pelo StorageService
        // Continuar mesmo assim - pode ser que o diretório já exista
      }
    }
  }
  
  // Verificar se o diretório é gravável (se não for, falhar aqui)
  try {
    fs.accessSync(storagePath, fs.constants.W_OK);
  } catch (error: any) {
    // Log será feito pelo StorageService
    throw new Error(`Diretório de uploads não é gravável. Verifique permissões: ${error.message}`);
  }

    const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, storagePath);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  // Criar regex dinâmico baseado nos tipos permitidos
  const allowedExtensions = allowedMimeTypes.map(type => {
    if (type.startsWith('image/')) return 'jpeg|jpg|png|gif|webp';
    if (type.startsWith('video/')) return 'mp4|avi|mov|wmv|flv|webm|ogg';
    if (type.startsWith('audio/')) return 'mp3|wav|ogg';
    return '';
  }).filter(Boolean).join('|');

  const allowedTypesRegex = new RegExp(allowedExtensions, 'i');

  return multer({
    storage: storage,
    limits: {
      fileSize: config.maxSize
    },
    fileFilter: (_req, file, cb) => {
      const extname = allowedTypesRegex.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedMimeTypes.includes(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error(`Tipo de arquivo não permitido. Tipos permitidos: ${allowedMimeTypes.join(', ')}`));
      }
    }
  });
}

// Instância lazy do multer (criada apenas quando necessário)
let upload: multer.Multer | null = null;

// Função helper para obter instância atualizada do multer (lazy initialization)
function getMulterUpload() {
  // Criar configuração apenas quando necessário (não no carregamento do módulo)
  // Isso evita erros de permissão e banco não inicializado durante o startup
  try {
    upload = createMulterConfig();
    return upload;
  } catch (error: any) {
    // Se falhar, tentar novamente na próxima requisição
    // Isso permite que o diretório seja criado durante a instalação
    // Usar versão síncrona pois esta função não é async
    logWarnSync('Erro ao criar configuração do multer', { error: error.message });
    throw error;
  }
}

/**
 * @route GET /api/media
 * @desc Listar todos os arquivos de mídia
 * @access Private
 */
router.get('/', 
  ...paginationValidators,
  ...searchValidators,
  ...sortValidators,
  ...dateRangeValidators,
  ...mediaFilterValidators,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 10, search, type, subscriberId } = req.query;
      
      // Determinar se é admin (role 'admin' ou 'system_user')
      const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'system_user';
      
      // Obter subscriberId do request (do middleware de isolamento ou do query param)
      const requestSubscriberId = req.subscriberId || req.user?.subscriberId || (subscriberId ? parseInt(subscriberId as string) : undefined);
      
      const { 
        sortBy = 'created_at',
        sortOrder = 'desc',
        createdFrom,
        createdTo
      } = req.query;

      const result = await getMediaService().getMedia(
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20,
        {
          subscriberId: subscriberId ? parseInt(subscriberId as string) : undefined,
          mediaType: type as string,
          search: search as string,
          sortBy: sortBy as string | undefined,
          sortOrder: sortOrder as 'asc' | 'desc' | undefined,
          createdFrom: createdFrom as string | undefined,
          createdTo: createdTo as string | undefined,
        },
        requestSubscriberId,
        isAdmin
      );
      
      return res.json(result);
    } catch (error: any) {
      await logError('Erro ao listar mídia', error);
      return res.status(500).json({ 
        error: 'Erro ao listar mídia',
        message: error.message || 'Erro desconhecido'
      });
    }
  }
);

/**
 * @route GET /api/media/:id
 * @desc Obter arquivo de mídia por ID
 * @access Private
 */
router.get('/:id',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      
      // Determinar se é admin
      const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'system_user';
      
      // Obter subscriberId do request
      const requestSubscriberId = req.subscriberId || req.user?.subscriberId;
      
      const media = await getMediaService().getMediaById(mediaId, requestSubscriberId, isAdmin);
      if (!media) {
        return res.status(404).json({ error: 'Arquivo de mídia não encontrado' });
      }
      return res.json(media);
    } catch (error: any) {
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro ao obter arquivo de mídia' });
    }
  }
);

/**
 * @route POST /api/media/upload
 * @desc Upload de arquivo de mídia
 * @access Private
 */
router.post('/upload', uploadLimiter,
  async (req: AuthenticatedRequest, res: Response, next) => {
    // Log detalhado antes do multer processar (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      const sanitizedBody = sanitizeForLogging(req.body);
      await logDebug('Upload recebido', { headers: req.headers, body: sanitizedBody }).catch(() => {
        // Silenciosamente falhar - logging não disponível
      });
    }
    
    // Tratar erros do multer antes de passar para validação
    getMulterUpload().single('file')(req as any, res, async (err: any) => {
      if (err) {
        await logError('Erro no multer', err, { code: err.code }).catch(() => {
          // Silenciosamente falhar - logging não disponível
        });
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: 'Arquivo muito grande',
            message: `Tamanho máximo permitido: ${err.limit} bytes`
          });
        }
        if (err.message && err.message.includes('Tipo de arquivo não permitido')) {
          return res.status(400).json({ 
            error: 'Tipo de arquivo não permitido',
            message: err.message
          });
        }
        if (err.message && err.message.includes('Diretório de uploads')) {
          return res.status(500).json({ 
            error: 'Erro de configuração do servidor',
            message: 'Diretório de uploads não está configurado corretamente'
          });
        }
        return res.status(400).json({ 
          error: 'Erro ao processar arquivo',
          message: err.message || 'Erro desconhecido no upload'
        });
      }
      
      // Log após multer processar (apenas em desenvolvimento)
      if (process.env.NODE_ENV === 'development' && req.file) {
        await logDebug('Multer processou', { file: { fieldname: req.file.fieldname, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, filename: req.file.filename } }).catch(() => {
          // Silenciosamente falhar - logging não disponível
        });
      }
      
      return next();
    });
  },
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString(),
  body('tags').optional().isString(),
  body('subscriberId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Log detalhado no handler principal (apenas em desenvolvimento)
      if (process.env.NODE_ENV === 'development') {
        const sanitizedBody = sanitizeForLogging(req.body);
        await logDebug('Handler de upload', { body: sanitizedBody, file: req.file, user: req.user });
      }
      
      if (!req.file) {
        await logError('Nenhum arquivo recebido no handler', new Error('Nenhum arquivo enviado'));
        return res.status(400).json({ 
          error: 'Nenhum arquivo enviado',
          message: 'É necessário enviar um arquivo'
        });
      }

      // Verificar se usuário está autenticado
      if (!req.user || !req.user.id) {
        return res.status(401).json({ 
          error: 'Usuário não autenticado',
          message: 'É necessário estar autenticado para fazer upload'
        });
      }

      // Determinar se é admin
      const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'system_user';
      
      // Obter subscriberId do request (do middleware ou do body)
      const requestSubscriberId = req.subscriberId || req.user?.subscriberId || req.user?.clientId;
      
      // Determinar subscriberId final
      let finalSubscriberId: number | undefined = req.body.subscriberId ? parseInt(req.body.subscriberId) : undefined;
      
      // Se não foi fornecido e usuário não é admin, usar subscriberId do usuário
      if (!finalSubscriberId && !isAdmin && requestSubscriberId) {
        finalSubscriberId = requestSubscriberId;
      }
      
      // Se admin não forneceu subscriberId, buscar primeiro subscriber ativo
      if (!finalSubscriberId && isAdmin) {
        try {
          const db = require('../config/database').getDatabase();
          const firstSubscriber = await db.findFirst(`
            SELECT subscriber_id FROM subscribers WHERE is_active = true LIMIT 1
          `);
          if (firstSubscriber) {
            finalSubscriberId = firstSubscriber.subscriber_id;
            await logDebug('[Media] Admin usando primeiro subscriber ativo', { subscriberId: finalSubscriberId });
          } else {
            return res.status(400).json({
              success: false,
              error: 'subscriberId é obrigatório',
              message: 'É necessário fornecer subscriberId ou ter pelo menos um subscriber ativo'
            });
          }
        } catch (dbError: any) {
          await logError('Erro ao buscar subscriber', dbError);
          return res.status(400).json({
            success: false,
            error: 'subscriberId é obrigatório',
            message: 'Não foi possível determinar o subscriber. Forneça subscriberId explicitamente.'
          });
        }
      }

      // Validar que finalSubscriberId foi definido
      if (!finalSubscriberId || finalSubscriberId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'subscriber_id é obrigatório',
          message: 'Não foi possível determinar o subscriber. Forneça subscriberId explicitamente.'
        });
      }

      // Validar limites do plano antes de fazer upload
      try {
        const subscriberService = getSubscriberService();
        // Validar limite de storage
        await subscriberService.validateStorageLimit(finalSubscriberId, req.file.size);
        // Validar limite de medias
        await subscriberService.validatePlanLimits(finalSubscriberId, 'media');
      } catch (limitError: any) {
        // Remover arquivo temporário se validação falhar
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          // Ignorar erro ao remover arquivo temporário
        }
        return res.status(400).json({
          success: false,
          error: 'Limite do plano excedido',
          message: limitError.message || 'Limite do plano foi excedido'
        });
      }

      const buffer = fs.readFileSync(req.file.path);

      // Processar tags
      let processedTags: string[] = [];
      if (req.body.tags) {
        const tagsStr = String(req.body.tags);
        processedTags = tagsStr.includes(',') 
          ? tagsStr.split(',').map(t => t.trim()).filter(Boolean)
          : [tagsStr.trim()].filter(Boolean);
      }

      const media = await getMediaService().createMedia({
        name: req.body.name || req.file.originalname,
        description: req.body.description,
        tags: processedTags,
        subscriberId: finalSubscriberId,
        createdBy: req.user?.id || 0,
        file: {
          buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
      }, requestSubscriberId, isAdmin);
      
      return res.status(201).json({
        success: true,
        data: media
      });
    } catch (error: any) {
      await logError('Erro ao fazer upload do arquivo', error, {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
        subscriberId: req.body.subscriberId,
        userId: req.user?.id
      });
      
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      
      return res.status(400).json({ 
        success: false,
        error: 'Erro ao fazer upload do arquivo',
        message: error.message || 'Erro desconhecido ao processar upload',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * @route POST /api/media/upload-multiple
 * @desc Upload múltiplo de arquivos de mídia
 * @access Private
 */
router.post('/upload-multiple', 
  uploadLimiter,
  (req, res, next) => getMulterUpload().array('files', 10)(req, res, next), // Máximo 10 arquivos
  body('subscriberId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Verificar se usuário está autenticado
      if (!req.user || !req.user.id) {
        return res.status(401).json({ 
          error: 'Usuário não autenticado',
          message: 'É necessário estar autenticado para fazer upload'
        });
      }

      // Determinar se é admin
      const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'system_user';
      
      // Determinar subscriberId usando helper centralizado
      const finalSubscriberId = await determineSubscriberId({
        bodySubscriberId: req.body.subscriberId,
        userSubscriberId: req.user?.subscriberId,
        userClientId: req.user?.clientId,
        requestSubscriberId: req.subscriberId,
        isAdmin,
        fallbackToFirstActive: isAdmin // Admin pode usar primeiro ativo como fallback
      });

      // Validar que subscriberId foi determinado
      if (!finalSubscriberId || finalSubscriberId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'subscriber_id é obrigatório',
          message: 'Não foi possível determinar o subscriber. Forneça subscriberId explicitamente.'
        });
      }

      // Validar limites de plano e storage antes de processar uploads
      try {
        const subscriberService = getSubscriberService();
        // Calcular tamanho total dos arquivos
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        // Validar storage
        await subscriberService.validateStorageLimit(finalSubscriberId, totalSize);
        // Validar limite de medias (contar quantas serão criadas)
        const currentCount = await subscriberService.getCurrentResourceCount(finalSubscriberId, 'media');
        const limits = await subscriberService.getMaxLimits(finalSubscriberId);
        const maxMedias = limits.medias;
        if (maxMedias !== undefined && currentCount + files.length > maxMedias) {
          throw new Error(`Limite de mídias excedido. Você pode criar no máximo ${maxMedias} mídias. Você já possui ${currentCount} e está tentando criar ${files.length} adicionais.`);
        }
      } catch (limitError: any) {
        // Remover arquivos temporários se validação falhar
        files.forEach(file => {
          try {
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (unlinkError) {
            // Ignorar erro ao remover arquivo temporário
          }
        });
        return res.status(400).json({
          success: false,
          error: 'Limite do plano excedido',
          message: limitError.message || 'Limite de storage ou mídias do plano foi excedido'
        });
      }

      // Ler todos os arquivos de forma assíncrona (paralelo)
      const fileBuffers = await Promise.all(
        files.map(file => fs.promises.readFile(file.path))
      );

      const created = await getMediaService().createMultipleMedia(
        files.map((file, index) => ({
          buffer: fileBuffers[index],
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        })),
        finalSubscriberId,
        req.user?.id || 0,
        req.subscriberId || req.user?.subscriberId || req.user?.clientId,
        isAdmin
      );
      
      return res.status(201).json(created);
    } catch (error: any) {
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message || 'Erro ao fazer upload dos arquivos' });
    }
  }
);

/**
 * @route PUT /api/media/:id
 * @desc Atualizar arquivo de mídia
 * @access Private (Admin, Gerente Marketing, Editoração)
 */
router.put('/:id',
  ...idParamValidatorDefault,
  ...updateMediaValidators,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      
      // Determinar se é admin
      const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'system_user';
      
      // Obter subscriberId do request
      const requestSubscriberId = req.subscriberId || req.user?.subscriberId || req.user?.clientId;
      
      // Usar ID do usuário autenticado
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      
      // Processar tags se fornecidas (aceita string ou array)
      let processedTags: string[] | undefined = undefined;
      if (req.body.tags !== undefined && req.body.tags !== null) {
        if (Array.isArray(req.body.tags)) {
          // Se já é array, usar diretamente (filtrando vazios)
          processedTags = req.body.tags.map((t: any) => String(t).trim()).filter(Boolean);
        } else {
          // Se é string, converter para array
          const tagsStr = String(req.body.tags).trim();
          if (tagsStr) {
            processedTags = tagsStr.includes(',') 
              ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean)
              : [tagsStr].filter(Boolean);
          }
        }
      }
      
      const mediaData = {
        name: req.body.name,
        description: req.body.description,
        tags: processedTags,
        status: req.body.status,
        approvalStatus: req.body.approvalStatus,
        rejectionReason: req.body.rejectionReason
      };
      
      const media = await getMediaService().updateMedia(mediaId, mediaData, userId, requestSubscriberId, isAdmin);
      if (!media) {
        return res.status(404).json({ error: 'Arquivo de mídia não encontrado' });
      }
      return res.json(media);
    } catch (error: any) {
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      // Log detalhado do erro para debug
      logError('Erro ao atualizar mídia', error, { 
        mediaId: req.params.id, 
        body: sanitizeForLogging(req.body),
        userId: req.user?.id 
      });
      return res.status(400).json({ 
        error: error.message || 'Erro ao atualizar arquivo de mídia',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * @route DELETE /api/media/:id
 * @desc Deletar arquivo de mídia
 * @access Private (Admin, Gerente Marketing, Editoração)
 */
router.delete('/:id',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      
      // Determinar se é admin
      const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'system_user';
      
      // Obter subscriberId do request
      const requestSubscriberId = req.subscriberId || req.user?.subscriberId || req.user?.clientId;
      
      // Usar ID do usuário autenticado
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      
      await getMediaService().deleteMedia(mediaId, userId, requestSubscriberId, isAdmin);
      return res.json({ message: 'Arquivo de mídia deletado com sucesso' });
    } catch (error: any) {
      if (error.message?.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro ao deletar arquivo de mídia' });
    }
  }
);

/**
 * @route GET /api/media/:id/download
 * @desc Download de arquivo de mídia
 * @access Private
 */
router.get('/:id/download',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const media = await getMediaService().getMediaById(mediaId);
      if (!media) {
        return res.status(404).json({ error: 'Arquivo de mídia não encontrado' });
      }

      // Verificar caminho com compatibilidade client-X/subscriber-X
      let filePath = media.filePath;
      if (!fs.existsSync(filePath)) {
        // Tentar caminho alternativo
        const altPath = filePath.replace(/client-(\d+)/, 'subscriber-$1').replace(/subscriber-(\d+)/, 'client-$1');
        if (altPath !== filePath && fs.existsSync(altPath)) {
          filePath = altPath;
        } else {
          return res.status(404).json({ error: 'Arquivo físico não encontrado' });
        }
      }

      return res.download(filePath, media.name);
    } catch (error: any) {
      logError('Erro ao fazer download do arquivo', error, { mediaId: req.params.id });
      return res.status(500).json({ error: 'Erro ao fazer download do arquivo' });
    }
  }
);

/**
 * @route POST /api/media/:id/process
 * @desc Processar arquivo de mídia (gerar thumbnails, otimizar, etc.)
 * @access Private
 */
router.post('/:id/process',
  param('id').isInt({ min: 1 }),
  body('generateThumbnail').optional().isBoolean(),
  body('optimize').optional().isBoolean(),
  body('resize').optional().isObject(),
  body('resize.width').optional().isInt({ min: 1 }),
  body('resize.height').optional().isInt({ min: 1 }),
  body('resize.fit').optional().isIn(['cover', 'contain', 'fill', 'inside', 'outside']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const processOptions = req.body;

      // Verificar se mídia existe
      const media = await getMediaService().getMediaById(mediaId);
      if (!media) {
        return res.status(404).json({ 
          success: false,
          error: 'Mídia não encontrada' 
        });
      }

      // Processar mídia
      const result = await getMediaService().processMediaById(mediaId, {
        generateThumbnail: processOptions.generateThumbnail !== false, // Padrão: true
        optimize: processOptions.optimize !== false, // Padrão: true
        resize: processOptions.resize || undefined
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (error: any) {
      await logError('Erro ao processar mídia', error);
      return res.status(500).json({ 
        success: false,
        error: 'Erro ao processar arquivo de mídia',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/media/stats/overview
 * @desc Obter estatísticas de mídia
 * @access Private
 */
router.get('/stats/overview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Determinar se é admin
    const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'system_user';
    
    // Obter subscriberId do request
    const requestSubscriberId = req.subscriberId || req.user?.subscriberId || req.user?.clientId;
    
    // Obter subscriberId do query param (se admin especificou)
    const subscriberId = req.query.subscriberId ? parseInt(req.query.subscriberId as string) : undefined;
    
    const stats = await getMediaService().getMediaStats(subscriberId, requestSubscriberId, isAdmin);
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

/**
 * @route GET /api/media/stats/storage
 * @desc Obter estatísticas de armazenamento
 * @access Private
 */
router.get('/stats/storage', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getMediaService().getStorageStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao obter estatísticas de armazenamento' });
  }
});

/**
 * @route GET /api/media/quota/:subscriberId
 * @desc Verificar quota de armazenamento do subscriber
 * @access Private
 */
router.get('/quota/:subscriberId',
  param('subscriberId').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const subscriberId = parseInt(req.params.subscriberId);
      const storageService = new StorageService();
      
      const { uploadConfig } = require('../config/env').config;
      const quota = uploadConfig.mediaQuotaPerClient;
      const currentUsage = await storageService.getSubscriberStorageUsage(subscriberId);
      const available = quota - currentUsage;
      const usagePercent = quota > 0 ? (currentUsage / quota) * 100 : 0;

      return res.json({
        subscriberId,
        quota,
        currentUsage,
        available,
        usagePercent: Math.round(usagePercent * 100) / 100,
        quotaFormatted: storageService.formatBytes(quota),
        currentUsageFormatted: storageService.formatBytes(currentUsage),
        availableFormatted: storageService.formatBytes(available)
      });
    } catch (error: any) {
      await logError('Erro ao verificar quota do subscriber', error, { subscriberId: req.params.subscriberId });
      return res.status(500).json({ error: 'Erro ao verificar quota de armazenamento' });
    }
  }
);

// formatBytes() removido - usar storageService.formatBytes() ao invés

export default router;
