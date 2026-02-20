import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';
import { getAlertService } from './alertService';

export class ContractAuditService {
  private get db() {
    return getDatabase();
  }

  /**
   * Processa registros de contract_change_audit não processados.
   * Insere/Envia alertas para administradores e marca como processados.
   */
  async processPending(limit: number = 50): Promise<any[]> {
    try {
      const pending = await this.db.findMany(`
        SELECT * FROM contract_change_audit
        WHERE processed = false
        ORDER BY created_at ASC
        LIMIT $1
      `, [limit]);

      const results: any[] = [];

      for (const row of pending) {
        try {
          const alert = {
            id: `contract_audit_${row.id}_${Date.now()}`,
            ruleId: 'contract_change',
            type: 'contract_change',
            severity: 'warning',
            message: `Contrato ${row.contract_id} alterado (${row.action})`,
            details: {
              contract_id: row.contract_id,
              action: row.action,
              old_status: row.old_status,
              new_status: row.new_status,
              old_end_date: row.old_end_date,
              new_end_date: row.new_end_date,
              extra: row.details
            },
            timestamp: new Date().toISOString(),
            acknowledged: false
          };

          // Enviar alerta pelos canais padrão
          await getAlertService().sendAlert(alert as any, ['email', 'slack']);

          // Marcar como processado
          await this.db.executeRaw(`
            UPDATE contract_change_audit SET processed = true WHERE id = $1
          `, [row.id]);

          results.push({ id: row.id, status: 'processed' });
        } catch (err: any) {
          await logError('Erro ao processar contract_change_audit', err, { id: row.id });
          results.push({ id: row.id, status: 'error', error: err.message });
        }
      }

      await logInfo('Processed contract_change_audit', { count: results.length });
      return results;
    } catch (error: any) {
      await logError('processPending(contract_change_audit) failed', error);
      throw error;
    }
  }
}

let contractAuditServiceInstance: ContractAuditService | null = null;
export function getContractAuditService() {
  if (!contractAuditServiceInstance) {
    contractAuditServiceInstance = new ContractAuditService();
  }
  return contractAuditServiceInstance;
}

