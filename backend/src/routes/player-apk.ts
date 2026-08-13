import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { body, query, param } from 'express-validator';
import {
  authMiddleware,
  AuthenticatedRequest,
  authorizeRole,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { getDatabase } from '../config/database';
import { getOTAUpdateService } from '../services/otaUpdateService';
import { logError, logInfo } from '../utils/loggerHelper';

const router = Router();

const VIEW_ROLES = [
  'owner_system',
  'admin_sql',
  'admin',
  'operator',
  'operador_tecnico',
  'publisher_user',
  'subscriber_user',
];
const DOWNLOAD_ROLES = ['owner_system', 'admin_sql', 'admin', 'operator', 'operador_tecnico'];
const DESIGNATE_ROLES = ['owner_system', 'admin_sql', 'admin'];

const apkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'ota-updates');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `player-ad-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.apk') {
      cb(null, true);
      return;
    }
    cb(new Error('Envie um ficheiro .apk'));
  },
});

function isSchemaGap(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

const INSTALLER_FILENAME = 'Instala-Player-TotemDigital.apk';

function resolveInstallerApkPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'uploads', 'ota-updates', INSTALLER_FILENAME),
    path.resolve(process.cwd(), '..', 'install-pendrive', 'apk', INSTALLER_FILENAME),
    path.resolve(__dirname, '../../../install-pendrive/apk', INSTALLER_FILENAME),
  ];
  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}

function installerMeta(): {
  filename: string;
  fileSize: number;
  downloadUrl: string;
  summary: string;
} | null {
  const filePath = resolveInstallerApkPath();
  if (!filePath) return null;
  return {
    filename: INSTALLER_FILENAME,
    fileSize: fs.statSync(filePath).size,
    downloadUrl: '/api/player-apk/download?kind=installer',
    summary:
      'Instala o Player-AD e, se o boot ainda não for TotemDigital, grava os logos oficiais (BMP + bootanimation). O Player-AD-release.apk sozinho não muda o boot.',
  };
}

const DOCUMENTS = [
  {
    slug: 'manual-usuario',
    title: 'Manual do usuário',
    summary: 'Instalação, ativação e operação diária do Player-AD.',
    filename: '01-MANUAL-USUARIO.md',
  },
  {
    slug: 'manual-tecnico',
    title: 'Manual técnico',
    summary: 'Arquitetura, diagnóstico, logs, cache e manutenção.',
    filename: '02-MANUAL-TECNICO.md',
  },
  {
    slug: 'workflow',
    title: 'Workflow operacional',
    summary: 'Build, validação, designação, rollout e rollback.',
    filename: '03-WORKFLOW-OPERACIONAL.md',
  },
  {
    slug: 'fluxo',
    title: 'Fluxo de funcionamento',
    summary: 'Heartbeat, dispatch, reprodução, telemetria e atualização.',
    filename: '04-FLUXO-FUNCIONAMENTO.md',
  },
  {
    slug: 'requisitos-regras',
    title: 'Requisitos e regras',
    summary: 'Pré-requisitos, identidade, segurança e regras operacionais.',
    filename: '05-REQUISITOS-E-REGRAS.md',
  },
  {
    slug: 'funcionalidades',
    title: 'Funcionalidades e funções',
    summary: 'Catálogo das capacidades disponíveis no Player-AD.',
    filename: '06-FUNCIONALIDADES-E-FUNCOES.md',
  },
] as const;

function documentsRoot(): string {
  return path.resolve(__dirname, '../../../docs/player-apk');
}

function channelFrom(value: unknown): 'production' | 'testing' {
  return value === 'testing' ? 'testing' : 'production';
}

async function designatedRelease(channel: string): Promise<any | null> {
  return getDatabase().findFirst(
    `
      SELECT
        ou.id,
        ou.version,
        ou.version_code,
        ou.platform,
        ou.package_name,
        ou.signing_cert_sha256,
        ou.source_commit,
        ou.build_id,
        ou.original_filename,
        ou.file_path,
        ou.file_size,
        ou.checksum,
        ou.description,
        ou.changelog,
        ou.status,
        ou.released_at,
        prc.channel,
        prc.designated_at,
        prc.designated_by
      FROM player_release_channels prc
      JOIN ota_updates ou ON ou.id = prc.designated_update_id
      WHERE prc.platform = 'android'
        AND prc.channel = $1
        AND COALESCE(ou.is_active, true) = true
      LIMIT 1
    `,
    [channel],
  );
}

router.use(authMiddleware);

router.get(
  '/designated',
  authorizeRole(DOWNLOAD_ROLES),
  query('channel').optional().isIn(['production', 'testing']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const channel = channelFrom(req.query.channel);
      const release = await designatedRelease(channel);
      return res.json({
        success: true,
        schemaReady: true,
        installer: installerMeta(),
        data: release
          ? {
              id: release.id,
              version: release.version,
              versionCode: release.version_code,
              platform: release.platform,
              packageName: release.package_name,
              signingCertSha256: release.signing_cert_sha256,
              sourceCommit: release.source_commit,
              buildId: release.build_id,
              originalFilename: release.original_filename,
              fileSize: Number(release.file_size || 0),
              checksum: release.checksum,
              description: release.description,
              changelog: release.changelog,
              status: release.status,
              channel: release.channel,
              releasedAt: release.released_at,
              designatedAt: release.designated_at,
              downloadUrl: `/api/player-apk/download?channel=${channel}`,
            }
          : null,
      });
    } catch (error: any) {
      if (isSchemaGap(error)) {
        await logError('Schema APK desatualizado (player_release_channels / ota_updates)', error);
        return res.json({
          success: true,
          schemaReady: false,
          installer: installerMeta(),
          data: null,
        });
      }
      await logError('Erro ao consultar APK designado', error);
      return res.status(500).json({ success: false, error: 'Erro ao consultar APK designado' });
    }
  },
);

router.get(
  '/candidates',
  authorizeRole(DESIGNATE_ROLES),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await getDatabase().findMany(
        `
          SELECT
            id,
            version,
            version_code,
            status,
            file_size,
            checksum,
            original_filename,
            created_at,
            released_at
          FROM ota_updates
          WHERE platform IN ('android', 'all')
            AND COALESCE(is_active, true) = true
            AND status IN ('draft', 'testing', 'active', 'paused')
          ORDER BY id DESC
          LIMIT 50
        `,
      );
      return res.json({
        success: true,
        schemaReady: true,
        data: (rows || []).map((row: any) => ({
          id: row.id,
          version: row.version,
          versionCode: row.version_code,
          status: row.status,
          fileSize: Number(row.file_size || 0),
          checksum: row.checksum,
          originalFilename: row.original_filename,
          createdAt: row.created_at,
          releasedAt: row.released_at,
        })),
      });
    } catch (error: any) {
      if (isSchemaGap(error)) {
        return res.json({ success: true, schemaReady: false, data: [] });
      }
      await logError('Erro ao listar candidatos APK', error);
      return res.status(500).json({ success: false, error: 'Erro ao listar candidatos APK' });
    }
  },
);

router.post(
  '/upload',
  authorizeRole(DESIGNATE_ROLES),
  apkUpload.single('file'),
  body('version').isString().notEmpty(),
  body('versionCode').optional({ nullable: true }).isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Ficheiro .apk é obrigatório' });
      }
      const version = String(req.body.version).trim();
      const versionCode = req.body.versionCode ? Number(req.body.versionCode) : undefined;
      const otaService = getOTAUpdateService();
      const created = await otaService.createUpdate(
        {
          version,
          versionCode,
          platform: 'android',
          packageName: 'br.com.smartchannel.playerad',
          originalFilename: req.file.originalname,
          filePath: req.file.path,
          description: 'Player-AD oficial (Configurações → APK)',
        },
        req.user!.id,
      );
      await otaService.activateUpdate(created.id, req.user!.id);
      await logInfo('Player-AD enviado e designado', {
        updateId: created.id,
        version,
        userId: req.user!.id,
      });
      return res.json({ success: true, updateId: created.id, version, channel: 'production' });
    } catch (error: any) {
      if (isSchemaGap(error)) {
        return res.status(503).json({
          success: false,
          error:
            'Schema desatualizado: falta player_release_channels ou colunas OTA. Actualize a instalação (--modo atualizar).',
        });
      }
      await logError('Erro ao enviar Player-AD', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Erro ao enviar Player-AD',
      });
    }
  },
);

router.post(
  '/designate',
  authorizeRole(DESIGNATE_ROLES),
  body('updateId').isInt({ min: 1 }),
  body('channel').optional().isIn(['production', 'testing']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const channel = channelFrom(req.body.channel);
      const updateId = Number(req.body.updateId);
      const result = await getDatabase().executeRaw(
        `
          WITH activated AS (
            UPDATE ota_updates
            SET
              status = CASE
                WHEN $2 = 'production' AND status IN ('draft', 'testing', 'paused', 'active') THEN 'active'
                WHEN $2 = 'testing' AND status = 'draft' THEN 'testing'
                ELSE status
              END,
              released_at = CASE
                WHEN $2 = 'production' THEN COALESCE(released_at, CURRENT_TIMESTAMP)
                ELSE released_at
              END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND platform IN ('android', 'all')
              AND COALESCE(is_active, true) = true
            RETURNING id, status
          )
          INSERT INTO player_release_channels (
            platform, channel, designated_update_id, designated_by, designated_at
          )
          SELECT 'android', $2, id, $3, CURRENT_TIMESTAMP
          FROM activated
          WHERE (
            ($2 = 'production' AND status = 'active')
            OR ($2 = 'testing' AND status IN ('active', 'testing'))
          )
          ON CONFLICT (platform, channel) DO UPDATE SET
            designated_update_id = EXCLUDED.designated_update_id,
            designated_by = EXCLUDED.designated_by,
            designated_at = EXCLUDED.designated_at,
            updated_at = CURRENT_TIMESTAMP
          RETURNING designated_update_id
        `,
        [updateId, channel, req.user!.id],
      );
      if (!result.rows?.length) {
        return res.status(409).json({
          success: false,
          error: 'Produção exige pacote Android ativo; teste aceita pacote ativo ou em teste',
        });
      }
      await logInfo('APK Player-AD designado', { updateId, channel, userId: req.user!.id });
      return res.json({ success: true, updateId, channel });
    } catch (error: any) {
      if (isSchemaGap(error)) {
        return res.status(503).json({
          success: false,
          error:
            'Schema desatualizado: falta player_release_channels. Actualize a instalação (--modo atualizar).',
        });
      }
      await logError('Erro ao designar APK Player-AD', error);
      return res.status(500).json({ success: false, error: 'Erro ao designar APK Player-AD' });
    }
  },
);

router.get(
  '/download',
  authorizeRole(DOWNLOAD_ROLES),
  query('channel').optional().isIn(['production', 'testing']),
  query('kind').optional().isIn(['player', 'installer']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.query.kind === 'installer') {
        const installerPath = resolveInstallerApkPath();
        if (!installerPath) {
          return res.status(404).json({ success: false, error: 'Instalador APK não encontrado' });
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        await logInfo('Download administrativo do Instala-Player-TotemDigital', {
          userId: req.user!.id,
        });
        return res.download(installerPath, INSTALLER_FILENAME);
      }
      const channel = channelFrom(req.query.channel);
      const release = await designatedRelease(channel);
      if (!release) {
        return res.status(404).json({ success: false, error: 'Nenhum APK designado' });
      }
      const filePath = path.resolve(String(release.file_path));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Arquivo APK não encontrado' });
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      await logInfo('Download administrativo do Player-AD', {
        updateId: release.id,
        channel,
        userId: req.user!.id,
      });
      return res.download(
        filePath,
        release.original_filename || `Player-AD-${release.version}.apk`,
      );
    } catch (error: any) {
      await logError('Erro no download do APK designado', error);
      return res.status(500).json({ success: false, error: 'Erro no download do APK' });
    }
  },
);

router.get('/documents', authorizeRole(VIEW_ROLES), (_req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    data: DOCUMENTS.map(({ filename: _filename, ...document }) => ({
      ...document,
      url: `/api/player-apk/documents/${document.slug}`,
    })),
  });
});

router.get(
  '/documents/:slug',
  authorizeRole(VIEW_ROLES),
  param('slug').isIn(DOCUMENTS.map((document) => document.slug)),
  validateRequest,
  (req: AuthenticatedRequest, res: Response) => {
    const document = DOCUMENTS.find((item) => item.slug === req.params.slug);
    if (!document) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }
    const filePath = path.join(documentsRoot(), document.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Documento não publicado' });
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('text/markdown; charset=utf-8');
    return res.sendFile(filePath);
  },
);

export default router;
