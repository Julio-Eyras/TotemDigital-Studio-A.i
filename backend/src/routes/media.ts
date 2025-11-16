import { Router, Request, Response } from 'express';
import { MediaService } from '../services/mediaService';
import { authMiddleware } from '../middleware/auth.middleware';
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
  if (!fs.existsSync(storagePath)) {
    try {
      fs.mkdirSync(storagePath, { recursive: true });
      console.log(`✅ Diretório de uploads criado: ${storagePath}`);
    } catch (error: any) {
      if (error.code === 'EACCES') {
        console.error(`❌ Erro de permissão ao criar diretório: ${storagePath}`);
        console.error(`   O diretório deve ser criado durante a instalação com permissões corretas`);
        console.error(`   Execute: sudo mkdir -p ${storagePath} && sudo chown -R $USER:$USER ${storagePath}`);
        throw new Error(`Diretório de uploads não pode ser criado: ${error.message}`);
      } else {
        throw error;
      }
    }
  }
  
  // Verificar se o diretório é gravável
  try {
    fs.accessSync(storagePath, fs.constants.W_OK);
  } catch (error: any) {
    console.error(`❌ Diretório de uploads não é gravável: ${storagePath}`);
    console.error(`   Execute: sudo chown -R $USER:$USER ${storagePath} && sudo chmod -R 755 ${storagePath}`);
    throw new Error(`Diretório de uploads não é gravável: ${error.message}`);
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

// Criar instância inicial do multer (será recriada quando configurações mudarem)
let upload = createMulterConfig();

// Função helper para obter instância atualizada do multer
function getMulterUpload() {
  // Recriar configuração para garantir que está atualizada
  upload = createMulterConfig();
  return upload;
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
  async (req: Request, res: Response) => {
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
  async (req: Request, res: Response) => {
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
  (req, res, next) => getMulterUpload().single('file')(req, res, next),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString(),
  body('tags').optional().isString(),
  body('clientId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
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

      const buffer = fs.readFileSync(req.file.path);

      const media = await getMediaService().createMedia({
        name: mediaData.name,
        title: mediaData.name,
        description: mediaData.description,
        tags: mediaData.tags ? String(mediaData.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
        clientId: mediaData.clientId || 1,
        createdBy: 1,
        file: {
          buffer,
          originalname: mediaData.originalName,
          mimetype: mediaData.mimetype,
          size: mediaData.size,
        },
      });
      res.status(201).json(media);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao fazer upload do arquivo' });
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
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const clientId = req.body.clientId ? parseInt(req.body.clientId) : undefined;
      const created: any[] = [];
      for (const file of files) {
        const buffer = fs.readFileSync(file.path);
        const media = await getMediaService().createMedia({
          name: file.originalname,
          title: file.originalname,
          description: '',
          tags: [],
          clientId: clientId || 1,
          createdBy: 1,
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
  async (req: Request, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const mediaData = req.body;
      const media = await getMediaService().updateMedia(mediaId, mediaData, 1); // Default user
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
  async (req: Request, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      await getMediaService().deleteMedia(mediaId, 1); // Default user
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
  async (req: Request, res: Response) => {
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
  async (req: Request, res: Response) => {
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
router.get('/stats/overview', async (req: Request, res: Response) => {
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
router.get('/stats/storage', async (req: Request, res: Response) => {
  try {
    const stats = await getMediaService().getStorageStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas de armazenamento' });
  }
});

export default router;
