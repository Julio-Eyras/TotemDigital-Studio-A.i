import { Router, Request, Response } from 'express';
import { MediaService } from '../services/mediaService';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|wmv|flv|webm|mp3|wav|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

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
  upload.single('file'),
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
  upload.array('files', 10), // Máximo 10 arquivos
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
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const mediaId = parseInt(req.params.id);
      const processOptions = req.body;
      // const result = await getMediaService().processMedia(mediaId, processOptions); // Método privado
      const result = { success: true, message: 'Processamento de mídia não implementado' }; // Mock
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao processar arquivo de mídia' });
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
