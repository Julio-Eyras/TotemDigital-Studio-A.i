import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { body, query, param } from 'express-validator';
import {
  authMiddleware,
  AuthenticatedRequest,
  authorizeRole,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { getDatabase } from '../config/database';
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
      await logError('Erro ao consultar APK designado', error);
      return res.status(500).json({ success: false, error: 'Erro ao consultar APK designado' });
    }
  },
);

router.post(
  '/designate',
  authorizeRole(['owner_system', 'admin_sql', 'admin']),
  body('updateId').isInt({ min: 1 }),
  body('channel').optional().isIn(['production', 'testing']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const channel = channelFrom(req.body.channel);
      const updateId = Number(req.body.updateId);
      const result = await getDatabase().executeRaw(
        `
          INSERT INTO player_release_channels (
            platform, channel, designated_update_id, designated_by, designated_at
          )
          SELECT 'android', $2, id, $3, CURRENT_TIMESTAMP
          FROM ota_updates
          WHERE id = $1
            AND platform IN ('android', 'all')
            AND (
              ($2 = 'production' AND status = 'active')
              OR ($2 = 'testing' AND status IN ('active', 'testing'))
            )
            AND COALESCE(is_active, true) = true
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
      await logError('Erro ao designar APK Player-AD', error);
      return res.status(500).json({ success: false, error: 'Erro ao designar APK Player-AD' });
    }
  },
);

router.get(
  '/download',
  authorizeRole(DOWNLOAD_ROLES),
  query('channel').optional().isIn(['production', 'testing']),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
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
