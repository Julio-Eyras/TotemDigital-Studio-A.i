import { Router, Response } from 'express';
import { MediaService } from '../services/mediaService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getMediaConfig, getMaxFileSize, getAllowedMimeTypes, getStoragePath } from '../config/mediaConfig';

const router = Router();

// Lazy initialization - só criar quando necessário
function getMediaService(): MediaService {
  if (!(global as any).mediaServiceInstance) {
    (global as any).mediaServiceInstance = new MediaService();
  }
  return (global as any).mediaServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

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
      console.log(`✅ Diretório de uploads criado: ${storagePath}`);
    } catch (error: any) {
      if (error.code === 'EACCES') {
        console.warn(`⚠️ Erro de permissão ao criar diretório: ${storagePath}`);
        console.warn(`   O diretório deve ser criado durante a instalação com permissões corretas`);
        console.warn(`   Execute: sudo mkdir -p ${storagePath} && sudo chown -R $USER:$USER ${storagePath}`);
        // Não falhar aqui - tentar usar o diretório mesmo assim (pode já existir)
        // Se realmente não existir, o erro será capturado na verificação de escrita abaixo
      } else {
        console.warn(`⚠️ Erro ao criar diretório: ${error.message}`);
        // Continuar mesmo assim - pode ser que o diretório já exista
      }
    }
  }
  
  // Verificar se o diretório é gravável (se não for, falhar aqui)
  try {
    fs.accessSync(storagePath, fs.constants.W_OK);
  } catch (error: any) {
    console.error(`❌ Diretório de uploads não é gravável: ${storagePath}`);
    console.error(`   Execute: sudo chown -R $USER:$USER ${storagePath} && sudo chmod -R 755 ${storagePath}`);
    throw new Error(`Diretório de uploads não é gravável. Verifique permissões: ${error.message}`);
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, storagePath);
    },
    filename: (req, file, cb) => {
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
    fileFilter: (req, file, cb) => {
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
    console.error('⚠️ Erro ao criar configuração do multer:', error.message);
    console.error('   Tentando novamente na próxima requisição...');
    throw error;
  }
}

/**
 * @route GET /api/media
 * @desc Listar todos os arquivos de mídia
 * @access Private
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('type').optional().isString().isIn(['image', 'video', 'audio']),
  query('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 10, search, type, clientId } = req.query;
      const result = await getMediaService().getAllMedia({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        type: type as string,
        clientId: clientId ? parseInt(clientId as string) : undefined
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar mídia' });
    }
  }
);

/**
 * @route GET /api/media/:id
 * @desc Obter arquivo de mídia por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const media = await getMediaService().getMediaById(mediaId);
      if (!media) {
        return res.status(404).json({ error: 'Arquivo de mídia não encontrado' });
      }
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter arquivo de mídia' });
    }
  }
);

/**
 * @route POST /api/media/upload
 * @desc Upload de arquivo de mídia
 * @access Private
 */
router.post('/upload',
  (req, res, next) => {
    // Tratar erros do multer antes de passar para validação
    getMulterUpload().single('file')(req, res, (err: any) => {
      if (err) {
        console.error('❌ Erro no multer:', err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: 'Arquivo muito grande',
            message: `Tamanho máximo permitido: ${err.limit} bytes`
          });
        }
        if (err.message.includes('Tipo de arquivo não permitido')) {
          return res.status(400).json({ 
            error: 'Tipo de arquivo não permitido',
            message: err.message
          });
        }
        if (err.message.includes('Diretório de uploads')) {
          return res.status(500).json({ 
            error: 'Erro de configuração do servidor',
            message: 'Diretório de uploads não está configurado corretamente'
          });
        }
        return res.status(400).json({ 
          error: 'Erro ao processar arquivo',
          message: err.message
        });
      }
      next();
    });
  },
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString(),
  body('tags').optional().isString(),
  body('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
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

      const mediaData = {
        name: req.body.name || req.file.originalname,
        description: req.body.description,
        tags: req.body.tags,
        clientId: req.body.clientId ? parseInt(req.body.clientId) : undefined,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      };

      // Se clientId não foi fornecido e usuário é client, usar clientId do usuário
      let finalClientId = mediaData.clientId;
      if (!finalClientId && req.user.role === 'client' && req.user.clientId) {
        finalClientId = req.user.clientId;
      }
      // Se ainda não tem clientId, usar 1 como padrão (admin pode criar sem cliente específico)
      if (!finalClientId) {
        finalClientId = 1;
      }

      const buffer = fs.readFileSync(req.file.path);

      const media = await getMediaService().createMedia({
        name: mediaData.name,
        title: mediaData.name,
        description: mediaData.description,
        tags: mediaData.tags ? String(mediaData.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
        clientId: finalClientId,
        createdBy: req.user.id, // Usar ID do usuário autenticado (userId é alias de id)
        file: {
          buffer,
          originalname: mediaData.originalName,
          mimetype: mediaData.mimetype,
          size: mediaData.size,
        },
      });
      
      res.status(201).json({
        success: true,
        data: media
      });
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload do arquivo:', error.message);
      console.error('❌ Stack trace:', error.stack);
      res.status(400).json({ 
        error: 'Erro ao fazer upload do arquivo',
        message: error.message || 'Erro desconhecido ao processar upload'
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
  (req, res, next) => getMulterUpload().array('files', 10)(req, res, next), // Máximo 10 arquivos
  body('clientId').optional().isInt({ min: 1 }),
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

      const clientId = req.body.clientId ? parseInt(req.body.clientId) : undefined;
      
      // Se clientId não foi fornecido e usuário é client, usar clientId do usuário
      let finalClientId = clientId;
      if (!finalClientId && req.user.role === 'client' && req.user.clientId) {
        finalClientId = req.user.clientId;
      }
      // Se ainda não tem clientId, usar 1 como padrão
      if (!finalClientId) {
        finalClientId = 1;
      }

      const created: any[] = [];
      for (const file of files) {
        const buffer = fs.readFileSync(file.path);
        const media = await getMediaService().createMedia({
          name: file.originalname,
          title: file.originalname,
          description: '',
          tags: [],
          clientId: finalClientId,
          createdBy: req.user.id, // Usar ID do usuário autenticado (userId é alias de id)
          file: {
            buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
        });
        created.push(media);
      }
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao fazer upload dos arquivos' });
    }
  }
);

/**
 * @route PUT /api/media/:id
 * @desc Atualizar arquivo de mídia
 * @access Private
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString(),
  body('tags').optional().isString(),
  body('isActive').optional().isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const mediaData = req.body;
      // Usar ID do usuário autenticado
      const userId = req.user?.id || 1;
      const media = await getMediaService().updateMedia(mediaId, mediaData, userId);
      if (!media) {
        return res.status(404).json({ error: 'Arquivo de mídia não encontrado' });
      }
      res.json(media);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar arquivo de mídia' });
    }
  }
);

/**
 * @route DELETE /api/media/:id
 * @desc Deletar arquivo de mídia
 * @access Private
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      // Usar ID do usuário autenticado
      const userId = req.user?.id || 1;
      await getMediaService().deleteMedia(mediaId, userId);
      res.json({ message: 'Arquivo de mídia deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar arquivo de mídia' });
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

      res.download(media.filePath, media.name);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao fazer download do arquivo' });
    }
  }
);

/**
 * @route GET /api/media/:id/thumbnail
 * @desc Obter thumbnail do arquivo de mídia
 * @access Private
 */
router.get('/:id/thumbnail',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const thumbnail = await getMediaService().getThumbnail(mediaId);
      if (!thumbnail) {
        return res.status(404).json({ error: 'Thumbnail não encontrado' });
      }

      res.sendFile(thumbnail);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter thumbnail' });
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

      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao processar mídia:', error.message);
      res.status(500).json({ 
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
    const stats = await getMediaService().getMediaStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

/**
 * @route GET /api/media/stats/storage
 * @desc Obter estatísticas de armazenamento
 * @access Private
 */
router.get('/stats/storage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getMediaService().getStorageStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas de armazenamento' });
  }
});

export default router;
