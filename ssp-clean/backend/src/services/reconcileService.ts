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
      // Buscar até limit jobs pendentes e executar um por um
      const jobs = await this.db.findMany(`
        SELECT job_id FROM reconcile_plan_publisher_jobs
        WHERE processed_at IS NULL
        ORDER BY created_at
        LIMIT $1
      `, [limit]);

      const results: any[] = [];
      for (const j of jobs) {
        const r = await this.db.findFirst(`SELECT execute_reconcile_job($1) as result`, [j.job_id]);
        results.push(r?.result || null);
      }

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

  /**
   * Reconcile jobs filtered by plan_id (processa jobs pendentes para o plan)
   */
  async reconcilePlan(planId: number, limit: number = 100): Promise<any[]> {
    try {
      const jobs = await this.db.findMany(`
        SELECT job_id FROM reconcile_plan_publisher_jobs
        WHERE processed_at IS NULL AND plan_id = $1
        ORDER BY created_at
        LIMIT $2
      `, [planId, limit]);

      const results: any[] = [];
      for (const j of jobs) {
        const r = await this.db.findFirst(`SELECT execute_reconcile_job($1) as result`, [j.job_id]);
        results.push(r?.result || null);
      }
      await logInfo('Reconcile: processed plan jobs', { planId, count: results.length });
      return results;
    } catch (error: any) {
      await logError('Reconcile: error processing plan jobs', error, { planId });
      throw error;
    }
  }

  /**
   * Reconcile all pending jobs regardless of plan
   */
  async reconcileAll(limitPerBatch: number = 100): Promise<any[]> {
    return await this.processPendingJobs(limitPerBatch);
  }
}

let reconcileServiceInstance: ReconcileService | null = null;
export function getReconcileService(): ReconcileService {
  if (!reconcileServiceInstance) {
    reconcileServiceInstance = new ReconcileService();
  }
  return reconcileServiceInstance;
}

