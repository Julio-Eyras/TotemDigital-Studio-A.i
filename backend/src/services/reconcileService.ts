import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';

export class ReconcileService {
  private get db() {
    return getDatabase();
  }

  /**
   * Processa N jobs pendentes (por padrão 100)
   */
  async processPendingJobs(limit: number = 100): Promise<any[]> {
    try {
      // Chamar função SQL process_pending_reconcile_jobs
      const rows = await this.db.findMany(`SELECT execute_reconcile_job(job_id) as result FROM reconcile_plan_publisher_jobs WHERE processed_at IS NULL ORDER BY created_at LIMIT $1`, [limit]);
      const results = rows.map((r: any) => r.result);
      await logInfo('Reconcile: processed pending jobs', { count: results.length });
      return results;
    } catch (error: any) {
      await logError('Reconcile: error processing jobs', error);
      throw error;
    }
  }

  /**
   * Endpoint-friendly: processa imediatamente (chamado pelo route)
   */
  async processNow(limit: number = 100): Promise<any[]> {
    return await this.processPendingJobs(limit);
  }
}

let reconcileServiceInstance: ReconcileService | null = null;
export function getReconcileService() {
  if (!reconcileServiceInstance) reconcileServiceInstance = new ReconcileService();
  return reconcileServiceInstance;
}

import { getDatabase } from '../config/database';
import { logInfo, logError } from '../utils/loggerHelper';

export class ReconcileService {
  private get db() {
    return getDatabase();
  }

  /**
   * Reconcile a single plan (idempotente)
   */
  async reconcilePlan(planId: number): Promise<void> {
    try {
      await logInfo('[ReconcileService] Iniciando reconciliação para plan_id', { planId });
      // Chamar função SQL que realiza a reconciliação (implementada em parte14)
      await this.db.executeRaw(`SELECT reconcile_plan_publisher_access($1)`, [planId]);
      await logInfo('[ReconcileService] Reconciliação concluída para plan_id', { planId });
    } catch (error: any) {
      await logError('[ReconcileService] Erro na reconciliação para plan_id', error, { planId });
      throw error;
    }
  }

  /**
   * Reconcile all plans
   */
  async reconcileAll(): Promise<void> {
    try {
      await logInfo('[ReconcileService] Iniciando reconciliação global (todos os planos)');
      await this.db.executeRaw(`SELECT reconcile_all_plan_publisher_access()`, []);
      await logInfo('[ReconcileService] Reconciliação global concluída');
    } catch (error: any) {
      await logError('[ReconcileService] Erro na reconciliação global', error);
      throw error;
    }
  }
}

let reconcileServiceInstance: ReconcileService | null = null;
export function getReconcileService(): ReconcileService {
  if (!reconcileServiceInstance) {
    reconcileServiceInstance = new ReconcileService();
  }
  return reconcileServiceInstance;
}

