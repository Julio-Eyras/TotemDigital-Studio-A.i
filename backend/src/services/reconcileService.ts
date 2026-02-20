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

