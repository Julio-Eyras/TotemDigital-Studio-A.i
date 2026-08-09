import { getDatabase } from '../config/database';
import { getRemoteCommandService } from './remoteCommandService';

export interface PlayerSyncEnvelope {
  schemaVersion: string;
  syncId: string;
  heartbeat?: Record<string, unknown>;
  events?: unknown[];
  commandResults?: unknown[];
  knownPlanVersion?: string;
}

export interface SyncValidationResult {
  value?: PlayerSyncEnvelope;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validatePlayerSyncEnvelope(value: unknown): SyncValidationResult {
  if (!isObject(value)) return { errors: ['envelope deve ser um objeto'] };

  const errors: string[] = [];
  const schemaVersion =
    typeof value.schemaVersion === 'number' ? String(value.schemaVersion) : value.schemaVersion;
  if (typeof schemaVersion !== 'string' || !schemaVersion.trim() || schemaVersion.length > 32) {
    errors.push('schemaVersion deve ser string ou número não vazio');
  }
  if (typeof value.syncId !== 'string' || !value.syncId.trim() || value.syncId.length > 200) {
    errors.push('syncId deve ser uma string não vazia de até 200 caracteres');
  }
  if (value.heartbeat !== undefined && !isObject(value.heartbeat)) {
    errors.push('heartbeat deve ser um objeto');
  }
  if (value.events !== undefined && (!Array.isArray(value.events) || value.events.length > 50)) {
    errors.push('events deve ser um array com até 50 itens');
  }
  if (
    value.commandResults !== undefined &&
    (!Array.isArray(value.commandResults) || value.commandResults.length > 50)
  ) {
    errors.push('commandResults deve ser um array com até 50 itens');
  }
  if (
    value.knownPlanVersion !== undefined &&
    value.knownPlanVersion !== null &&
    typeof value.knownPlanVersion !== 'string'
  ) {
    errors.push('knownPlanVersion deve ser uma string');
  }
  if (
    value.heartbeat === undefined &&
    value.events === undefined &&
    value.commandResults === undefined
  ) {
    errors.push('informe heartbeat, events ou commandResults');
  }

  if (errors.length) return { errors };
  return {
    errors: [],
    value: {
      schemaVersion: String(schemaVersion),
      syncId: String(value.syncId),
      ...(value.heartbeat !== undefined ? { heartbeat: value.heartbeat as Record<string, unknown> } : {}),
      ...(value.events !== undefined ? { events: value.events as unknown[] } : {}),
      ...(value.commandResults !== undefined ? { commandResults: value.commandResults as unknown[] } : {}),
      ...(typeof value.knownPlanVersion === 'string'
        ? { knownPlanVersion: value.knownPlanVersion as string }
        : {}),
    },
  };
}

export function validateSyncCommandResult(
  value: unknown,
  index: number
): {
  command?: { requestId: number; status: 'completed' | 'failed'; result?: unknown; error?: string };
  rejection?: { index: number; requestId: string | number | null; reason: string };
} {
  const requestId = isObject(value) ? value.requestId : null;
  const reject = (reason: string) => ({
    rejection: {
      index,
      requestId:
        typeof requestId === 'string' || typeof requestId === 'number' ? requestId : null,
      reason,
    },
  });
  if (!isObject(value)) return reject('resultado deve ser um objeto');
  const numericId =
    typeof requestId === 'number' ? requestId : Number.parseInt(String(requestId || ''), 10);
  if (!Number.isSafeInteger(numericId) || numericId < 1) return reject('requestId inválido');
  if (value.status !== 'completed' && value.status !== 'failed') {
    return reject('status deve ser completed ou failed');
  }
  if (value.error !== undefined && typeof value.error !== 'string') {
    return reject('error deve ser uma string');
  }
  return {
    command: {
      requestId: numericId,
      status: value.status,
      ...(value.result !== undefined ? { result: value.result } : {}),
      ...(value.error !== undefined ? { error: value.error } : {}),
    },
  };
}

export async function processSyncCommandResults(totemId: number, values: unknown[]): Promise<{
  accepted: number[];
  rejected: Array<{ index: number; requestId: string | number | null; reason: string }>;
}> {
  const accepted: number[] = [];
  const rejected: Array<{
    index: number;
    requestId: string | number | null;
    reason: string;
  }> = [];
  const service = getRemoteCommandService();

  for (let index = 0; index < values.length; index += 1) {
    const validation = validateSyncCommandResult(values[index], index);
    if (validation.rejection) {
      rejected.push(validation.rejection);
      continue;
    }
    const command = validation.command!;
    try {
      const owned = await getDatabase().findFirst(
        `SELECT command_id, command_type
         FROM remote_commands
         WHERE command_id = $1 AND totem_id = $2`,
        [command.requestId, totemId]
      );
      if (!owned) {
        rejected.push({ index, requestId: command.requestId, reason: 'comando não encontrado' });
        continue;
      }
      if (owned.command_type === 'screenshot' || owned.command_type === 'capture_screen') {
        rejected.push({
          index,
          requestId: command.requestId,
          reason: 'resultado de screenshot deve usar /api/player/command-result',
        });
        continue;
      }
      if (command.status === 'completed') {
        await service.markCommandAsCompleted(command.requestId, command.result);
      } else {
        await service.markCommandAsFailed(command.requestId, command.error || 'Comando falhou');
      }
      accepted.push(command.requestId);
    } catch (error: any) {
      rejected.push({
        index,
        requestId: command.requestId,
        reason: error?.message || 'falha ao processar resultado',
      });
    }
  }
  return { accepted, rejected };
}
