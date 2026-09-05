/**
 * Purge explícito de dados comerciais (não ligado ao OFF do multi-agência).
 * Dry-run por defeito; confirmação tipada para execução real.
 */
import fs from 'fs';
import path from 'path';
import { logError, logInfo, logWarn } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export const PURGE_CONFIRM_PHRASE = 'APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO';

export type PurgeScope =
  | 'billing'
  | 'campaigns'
  | 'playlists'
  | 'contracts'
  | 'subscribers'
  | 'media_files'
  | 'publishers_extra';

export const ALL_PURGE_SCOPES: PurgeScope[] = [
  'billing',
  'campaigns',
  'playlists',
  'contracts',
  'media_files',
  'subscribers',
  'publishers_extra',
];

type DbLike = {
  findFirst: (sql: string, params?: unknown[]) => Promise<Record<string, unknown> | null>;
  findMany?: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  executeRaw?: (sql: string, params?: unknown[]) => Promise<unknown>;
  tableExists?: (name: string) => Promise<boolean>;
};

export type CommercialPurgeInput = {
  dryRun?: boolean;
  confirmPhrase?: string;
  scopes?: PurgeScope[];
  publisherId?: number | null;
  keepPublishers?: boolean;
  keepMediaFiles?: boolean;
  triggeredBy?: number | null;
  scheduled?: boolean;
};

export type PurgeCounts = Record<string, number>;

export type CommercialPurgeResult = {
  ok: boolean;
  dryRun: boolean;
  publisherId: number | null;
  scopes: PurgeScope[];
  counts: Record<PurgeScope, PurgeCounts>;
  deleted: Record<string, number>;
  filesDeleted: string[];
  exportDir?: string;
  warnings: string[];
  message: string;
  runId?: number;
};

async function tableExists(db: DbLike, name: string): Promise<boolean> {
  if (db.tableExists) return db.tableExists(name);
  try {
    const row = await db.findFirst(
      `SELECT to_regclass($1) AS t`,
      [`public.${name}`]
    );
    return Boolean(row?.t);
  } catch {
    return false;
  }
}

async function countSql(db: DbLike, sql: string, params: unknown[] = []): Promise<number> {
  try {
    const row = await db.findFirst(sql, params);
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

/** Subscribers ligados à org (SPA) ou todos se publisherId null. */
function subscriberFilterSql(publisherId: number | null, alias = 's'): { sql: string; params: unknown[] } {
  if (publisherId == null) return { sql: 'TRUE', params: [] };
  return {
    sql: `EXISTS (
      SELECT 1 FROM subscriber_publisher_access spa
      WHERE spa.subscriber_id = ${alias}.subscriber_id
        AND spa.publisher_id = $1
        AND COALESCE(spa.is_active, true) = true
    )`,
    params: [publisherId],
  };
}

export async function previewCommercialPurge(
  db: DbLike,
  input: CommercialPurgeInput = {}
): Promise<CommercialPurgeResult> {
  const publisherId =
    input.publisherId != null && Number.isFinite(Number(input.publisherId))
      ? Number(input.publisherId)
      : null;
  const keepMediaFiles = input.keepMediaFiles !== false;
  let scopes = (input.scopes?.length ? input.scopes : ALL_PURGE_SCOPES).filter((s) =>
    ALL_PURGE_SCOPES.includes(s)
  ) as PurgeScope[];
  if (keepMediaFiles) scopes = scopes.filter((s) => s !== 'media_files');
  if (input.keepPublishers !== false) scopes = scopes.filter((s) => s !== 'publishers_extra');

  const counts = {} as Record<PurgeScope, PurgeCounts>;
  const warnings: string[] = [];
  const subF = subscriberFilterSql(publisherId);

  for (const scope of scopes) {
    counts[scope] = {};
  }

  if (scopes.includes('billing')) {
    if (await tableExists(db, 'subscriber_billing')) {
      counts.billing.subscriber_billing = await countSql(
        db,
        `SELECT COUNT(*)::int AS c FROM subscriber_billing sb
         JOIN subscribers s ON s.subscriber_id = sb.subscriber_id
         WHERE ${subF.sql}`,
        subF.params
      );
    }
    if (await tableExists(db, 'publisher_billing')) {
      counts.billing.publisher_billing = await countSql(
        db,
        publisherId == null
          ? `SELECT COUNT(*)::int AS c FROM publisher_billing`
          : `SELECT COUNT(*)::int AS c FROM publisher_billing WHERE publisher_id = $1`,
        publisherId == null ? [] : [publisherId]
      );
    }
  }

  if (scopes.includes('campaigns') && (await tableExists(db, 'campaigns'))) {
    counts.campaigns.campaigns = await countSql(
      db,
      `SELECT COUNT(*)::int AS c FROM campaigns c
       JOIN subscribers s ON s.subscriber_id = c.subscriber_id
       WHERE ${subF.sql}`,
      subF.params
    );
  }

  if (scopes.includes('playlists') && (await tableExists(db, 'playlists'))) {
    counts.playlists.playlists = await countSql(
      db,
      `SELECT COUNT(*)::int AS c FROM playlists p
       JOIN subscribers s ON s.subscriber_id = p.subscriber_id
       WHERE ${subF.sql}`,
      subF.params
    );
  }

  if (scopes.includes('contracts')) {
    if (await tableExists(db, 'subscriber_contracts')) {
      counts.contracts.subscriber_contracts = await countSql(
        db,
        `SELECT COUNT(*)::int AS c FROM subscriber_contracts sc
         JOIN subscribers s ON s.subscriber_id = sc.subscriber_id
         WHERE ${subF.sql}`,
        subF.params
      );
    }
    if (await tableExists(db, 'publisher_contracts')) {
      counts.contracts.publisher_contracts = await countSql(
        db,
        publisherId == null
          ? `SELECT COUNT(*)::int AS c FROM publisher_contracts`
          : `SELECT COUNT(*)::int AS c FROM publisher_contracts WHERE publisher_id = $1`,
        publisherId == null ? [] : [publisherId]
      );
    }
  }

  if (scopes.includes('media_files') && (await tableExists(db, 'medias'))) {
    counts.media_files.medias = await countSql(
      db,
      publisherId == null
        ? `SELECT COUNT(*)::int AS c FROM medias`
        : `SELECT COUNT(*)::int AS c FROM medias m
           WHERE m.publisher_id = $1
              OR EXISTS (
                SELECT 1 FROM subscriber_publisher_access spa
                WHERE spa.subscriber_id = m.subscriber_id AND spa.publisher_id = $1
              )`,
      publisherId == null ? [] : [publisherId]
    );
  }

  if (scopes.includes('subscribers') && (await tableExists(db, 'subscribers'))) {
    counts.subscribers.subscribers = await countSql(
      db,
      `SELECT COUNT(*)::int AS c FROM subscribers s WHERE ${subF.sql}`,
      subF.params
    );
  }

  if (scopes.includes('publishers_extra') && (await tableExists(db, 'publishers'))) {
    counts.publishers_extra.publishers = await countSql(
      db,
      publisherId == null
        ? `SELECT COUNT(*)::int AS c FROM publishers
           WHERE COALESCE(is_system_owner, false) = false AND COALESCE(is_active, true) = true`
        : `SELECT COUNT(*)::int AS c FROM publishers
           WHERE publisher_id = $1 AND COALESCE(is_system_owner, false) = false`,
      publisherId == null ? [] : [publisherId]
    );
  }

  const total = Object.values(counts).reduce(
    (acc, c) => acc + Object.values(c).reduce((a, n) => a + n, 0),
    0
  );
  if (total === 0) warnings.push('Nada a apagar com os filtros actuais.');
  if (publisherId != null) warnings.push(`Purge parcial: só organização publisher_id=${publisherId}.`);
  if (scopes.includes('media_files')) {
    warnings.push('media_files: apaga registos BD e ficheiros em disco (irreversível).');
  }

  return {
    ok: true,
    dryRun: true,
    publisherId,
    scopes,
    counts,
    deleted: {},
    filesDeleted: [],
    warnings,
    message: `Preview: ${total} registo(s) potencialmente afectados.`,
  };
}

async function execDelete(
  db: DbLike,
  deleted: Record<string, number>,
  key: string,
  sql: string,
  params: unknown[] = []
): Promise<void> {
  if (!db.executeRaw) throw new Error('Base sem escrita');
  await db.executeRaw(sql, params);
  // PostgreSQL DELETE não devolve rowCount no nosso wrapper — marcar como 1 se executou
  deleted[key] = (deleted[key] || 0) + 1;
}

export async function runCommercialPurge(
  db: DbLike,
  input: CommercialPurgeInput = {}
): Promise<CommercialPurgeResult> {
  const dryRun = input.dryRun !== false;
  const preview = await previewCommercialPurge(db, input);

  if (dryRun) {
    return {
      ...preview,
      dryRun: true,
      message: `Dry-run: nenhum DELETE executado. ${preview.message}`,
    };
  }

  if (input.confirmPhrase !== PURGE_CONFIRM_PHRASE && !input.scheduled) {
    return {
      ...preview,
      ok: false,
      dryRun: false,
      message: `Confirmação inválida. Escreva exactamente: ${PURGE_CONFIRM_PHRASE}`,
    };
  }

  if (!db.executeRaw) {
    return { ...preview, ok: false, dryRun: false, message: 'Base sem escrita' };
  }

  const exportDir = path.join(
    process.cwd(),
    'runtime',
    'purges',
    new Date().toISOString().replace(/[:.]/g, '-')
  );
  fs.mkdirSync(exportDir, { recursive: true });
  fs.writeFileSync(
    path.join(exportDir, 'preview.json'),
    JSON.stringify(preview, null, 2),
    'utf8'
  );

  const deleted: Record<string, number> = {};
  const filesDeleted: string[] = [];
  const publisherId = preview.publisherId;
  const scopes = preview.scopes;
  const subF = subscriberFilterSql(publisherId);
  const warnings = [...preview.warnings];

  try {
    // 1) Billing
    if (scopes.includes('billing')) {
      if (await tableExists(db, 'subscriber_billing')) {
        await execDelete(
          db,
          deleted,
          'subscriber_billing',
          `DELETE FROM subscriber_billing sb
           USING subscribers s
           WHERE sb.subscriber_id = s.subscriber_id AND ${subF.sql}`,
          subF.params
        );
      }
      if (await tableExists(db, 'publisher_billing')) {
        await execDelete(
          db,
          deleted,
          'publisher_billing',
          publisherId == null
            ? `DELETE FROM publisher_billing`
            : `DELETE FROM publisher_billing WHERE publisher_id = $1`,
          publisherId == null ? [] : [publisherId]
        );
      }
    }

    // 2) Campaigns (+ relation tables best-effort)
    if (scopes.includes('campaigns') && (await tableExists(db, 'campaigns'))) {
      for (const rel of ['campaign_medias', 'campaign_playlists', 'campaign_totems', 'campaign_locals']) {
        if (await tableExists(db, rel)) {
          await execDelete(
            db,
            deleted,
            rel,
            `DELETE FROM ${rel} cm
             USING campaigns c, subscribers s
             WHERE cm.campaign_id = c.campaign_id
               AND c.subscriber_id = s.subscriber_id
               AND ${subF.sql}`,
            subF.params
          );
        }
      }
      await execDelete(
        db,
        deleted,
        'campaigns',
        `DELETE FROM campaigns c
         USING subscribers s
         WHERE c.subscriber_id = s.subscriber_id AND ${subF.sql}`,
        subF.params
      );
    }

    // 3) Playlists
    if (scopes.includes('playlists') && (await tableExists(db, 'playlists'))) {
      if (await tableExists(db, 'playlist_items')) {
        await execDelete(
          db,
          deleted,
          'playlist_items',
          `DELETE FROM playlist_items pi
           USING playlists p, subscribers s
           WHERE pi.playlist_id = p.playlist_id
             AND p.subscriber_id = s.subscriber_id
             AND ${subF.sql}`,
          subF.params
        );
      }
      await execDelete(
        db,
        deleted,
        'playlists',
        `DELETE FROM playlists p
         USING subscribers s
         WHERE p.subscriber_id = s.subscriber_id AND ${subF.sql}`,
        subF.params
      );
    }

    // 4) Contracts
    if (scopes.includes('contracts')) {
      if (await tableExists(db, 'subscriber_contracts')) {
        await execDelete(
          db,
          deleted,
          'subscriber_contracts',
          `DELETE FROM subscriber_contracts sc
           USING subscribers s
           WHERE sc.subscriber_id = s.subscriber_id AND ${subF.sql}`,
          subF.params
        );
      }
      if (await tableExists(db, 'publisher_contracts')) {
        await execDelete(
          db,
          deleted,
          'publisher_contracts',
          publisherId == null
            ? `DELETE FROM publisher_contracts`
            : `DELETE FROM publisher_contracts WHERE publisher_id = $1`,
          publisherId == null ? [] : [publisherId]
        );
      }
    }

    // 5) Media files (BD + disco)
    if (scopes.includes('media_files') && (await tableExists(db, 'medias'))) {
      const findMany =
        db.findMany ||
        (async () => [] as unknown as Record<string, unknown>[]);
      const mediaRows = await findMany.call(
        db,
        publisherId == null
          ? `SELECT media_id, file_path FROM medias WHERE file_path IS NOT NULL`
          : `SELECT media_id, file_path FROM medias m
             WHERE m.publisher_id = $1
                OR EXISTS (
                  SELECT 1 FROM subscriber_publisher_access spa
                  WHERE spa.subscriber_id = m.subscriber_id AND spa.publisher_id = $1
                )`,
        publisherId == null ? [] : [publisherId]
      );
      fs.writeFileSync(
        path.join(exportDir, 'media-manifest.json'),
        JSON.stringify(mediaRows, null, 2),
        'utf8'
      );

      const mediaIds = (mediaRows || [])
        .map((r) => r.media_id)
        .filter((id) => id != null);
      if (mediaIds.length > 0) {
        for (const rel of ['playlist_items', 'campaign_medias', 'totem_playlist_items']) {
          if (!(await tableExists(db, rel))) continue;
          try {
            await db.executeRaw!(
              `DELETE FROM ${rel} WHERE media_id IN (${mediaIds
                .map((_: unknown, i: number) => `$${i + 1}`)
                .join(',')})`,
              mediaIds
            );
          } catch {
            /* ignore */
          }
        }
      }

      await execDelete(
        db,
        deleted,
        'medias',
        publisherId == null
          ? `DELETE FROM medias`
          : `DELETE FROM medias m
             WHERE m.publisher_id = $1
                OR EXISTS (
                  SELECT 1 FROM subscriber_publisher_access spa
                  WHERE spa.subscriber_id = m.subscriber_id AND spa.publisher_id = $1
                )`,
        publisherId == null ? [] : [publisherId]
      );

      try {
        const { StorageService } = await import('./storageService');
        const storage = new StorageService();
        for (const row of mediaRows || []) {
          const fp = row.file_path != null ? String(row.file_path) : '';
          if (!fp) continue;
          try {
            await storage.deleteMediaFile(fp);
            filesDeleted.push(fp);
} catch (eCatch: unknown) {
            const e = normalizeError(eCatch);
            warnings.push(`Falha ao apagar ficheiro ${fp}: ${e?.message || e}`);
          }
        }
 
} catch (eCatch: unknown) {
   const e = normalizeError(eCatch);
        warnings.push(`StorageService indisponível: ${e?.message || e}`);
      }
    }

    // 6) Subscribers
    if (scopes.includes('subscribers') && (await tableExists(db, 'subscribers'))) {
      if (await tableExists(db, 'subscriber_publisher_access')) {
        await execDelete(
          db,
          deleted,
          'subscriber_publisher_access',
          publisherId == null
            ? `DELETE FROM subscriber_publisher_access`
            : `DELETE FROM subscriber_publisher_access WHERE publisher_id = $1`,
          publisherId == null ? [] : [publisherId]
        );
      }
      await execDelete(
        db,
        deleted,
        'subscribers',
        `DELETE FROM subscribers s WHERE ${subF.sql}`,
        subF.params
      );
    }

    // 7) Publishers extra (nunca system owner)
    if (scopes.includes('publishers_extra') && (await tableExists(db, 'publishers'))) {
      await execDelete(
        db,
        deleted,
        'publishers_extra',
        publisherId == null
          ? `DELETE FROM publishers WHERE COALESCE(is_system_owner, false) = false`
          : `DELETE FROM publishers WHERE publisher_id = $1 AND COALESCE(is_system_owner, false) = false`,
        publisherId == null ? [] : [publisherId]
      );
    }

    let runId: number | undefined;
    if (await tableExists(db, 'installation_purge_runs')) {
      await db.executeRaw(
        `
        INSERT INTO installation_purge_runs (
          dry_run, publisher_id, scopes, counts, deleted, files_deleted, export_dir,
          warnings, triggered_by, scheduled, message, created_at
        ) VALUES (
          false, $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6,
          $7::jsonb, $8, $9, $10, CURRENT_TIMESTAMP
        )
      `,
        [
          publisherId,
          JSON.stringify(scopes),
          JSON.stringify(preview.counts),
          JSON.stringify(deleted),
          JSON.stringify(filesDeleted),
          exportDir,
          JSON.stringify(warnings),
          input.triggeredBy ?? null,
          Boolean(input.scheduled),
          'Purge comercial executado',
        ]
      );
      const last = await db.findFirst(
        `SELECT run_id FROM installation_purge_runs ORDER BY run_id DESC LIMIT 1`
      );
      runId = last?.run_id != null ? Number(last.run_id) : undefined;
    }

    await logInfo('Purge comercial executado', {
      publisherId,
      scopes,
      files: filesDeleted.length,
      runId,
    });

    return {
      ok: true,
      dryRun: false,
      publisherId,
      scopes,
      counts: preview.counts,
      deleted,
      filesDeleted,
      exportDir,
      warnings,
      message: `Purge concluído. Ficheiros apagados: ${filesDeleted.length}. Export: ${exportDir}`,
      runId,
    };} catch (error: unknown) {
      const e = normalizeError(error);
    await logError('Falha no purge comercial', e.error);
    return {
      ...preview,
      ok: false,
      dryRun: false,
      deleted,
      filesDeleted,
      exportDir,
      warnings,
      message: ((e.raw as { message?: string })?.message) || 'Falha no purge comercial',
    };
  }
}

export async function getLastPurgeRun(db: DbLike): Promise<Record<string, unknown> | null> {
  if (!(await tableExists(db, 'installation_purge_runs'))) return null;
  return db.findFirst(`SELECT * FROM installation_purge_runs ORDER BY run_id DESC LIMIT 1`);
}

export type PurgeScheduleInput = {
  cronExpression: string;
  scopes?: PurgeScope[];
  publisherId?: number | null;
  keepMediaFiles?: boolean;
  keepPublishers?: boolean;
  enabled?: boolean;
};

export async function upsertPurgeSchedule(
  db: DbLike,
  input: PurgeScheduleInput
): Promise<Record<string, unknown>> {
  if (!db.executeRaw) throw new Error('Base sem escrita');
  if (!(await tableExists(db, 'installation_purge_schedules'))) {
    throw new Error('Tabela installation_purge_schedules em falta — aplique o schema.');
  }
  const cron = String(input.cronExpression || '').trim();
  if (!cron) throw new Error('cronExpression obrigatório');

  await db.executeRaw(
    `
    INSERT INTO installation_purge_schedules (
      schedule_id, cron_expression, scopes, publisher_id, keep_media_files,
      keep_publishers, enabled, updated_at
    ) VALUES (
      1, $1, $2::jsonb, $3, $4, $5, $6, CURRENT_TIMESTAMP
    )
    ON CONFLICT (schedule_id) DO UPDATE SET
      cron_expression = EXCLUDED.cron_expression,
      scopes = EXCLUDED.scopes,
      publisher_id = EXCLUDED.publisher_id,
      keep_media_files = EXCLUDED.keep_media_files,
      keep_publishers = EXCLUDED.keep_publishers,
      enabled = EXCLUDED.enabled,
      updated_at = CURRENT_TIMESTAMP
  `,
    [
      cron,
      JSON.stringify(input.scopes?.length ? input.scopes : ['billing', 'campaigns', 'playlists']),
      input.publisherId ?? null,
      input.keepMediaFiles !== false,
      input.keepPublishers !== false,
      input.enabled !== false,
    ]
  );
  const row = await db.findFirst(
    `SELECT * FROM installation_purge_schedules WHERE schedule_id = 1`
  );
  return row || {};
}

export async function getPurgeSchedule(db: DbLike): Promise<Record<string, unknown> | null> {
  if (!(await tableExists(db, 'installation_purge_schedules'))) return null;
  return db.findFirst(`SELECT * FROM installation_purge_schedules WHERE schedule_id = 1`);
}

/** Tick do worker: corre schedule se due (cron-parser se disponível). */
export async function tickPurgeSchedule(db: DbLike): Promise<void> {
  const sched = await getPurgeSchedule(db);
  if (!sched || sched.enabled === false) return;
  const cronExpr = String(sched.cron_expression || '');
  if (!cronExpr) return;

  try {
    const { parseExpression } = await import('cron-parser');
    const interval = parseExpression(cronExpr, { currentDate: new Date() });
    const prev = interval.prev().toDate();
    const lastRun = sched.last_run_at ? new Date(String(sched.last_run_at)) : null;
    if (lastRun && lastRun >= prev) return;

    await logWarn('A executar purge agendado', { cronExpr });
    let scopes: PurgeScope[] | undefined;
    if (Array.isArray(sched.scopes)) {
      scopes = sched.scopes as PurgeScope[];
    } else if (typeof sched.scopes === 'string') {
      try {
        const parsed = JSON.parse(sched.scopes);
        if (Array.isArray(parsed)) scopes = parsed as PurgeScope[];
      } catch {
        /* ignore */
      }
    }

    await runCommercialPurge(db, {
      dryRun: false,
      scheduled: true,
      confirmPhrase: PURGE_CONFIRM_PHRASE,
      scopes,
      publisherId: sched.publisher_id != null ? Number(sched.publisher_id) : null,
      keepMediaFiles: sched.keep_media_files !== false,
      keepPublishers: sched.keep_publishers !== false,
    });
    if (db.executeRaw) {
      await db.executeRaw(
        `UPDATE installation_purge_schedules SET last_run_at = CURRENT_TIMESTAMP WHERE schedule_id = 1`
      );
 
}} catch (error: unknown) {
      const e = normalizeError(error);
    await logError('tickPurgeSchedule falhou', e.error);
  }
}
