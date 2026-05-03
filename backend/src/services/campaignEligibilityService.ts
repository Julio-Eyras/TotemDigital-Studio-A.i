/**
 * Elegibilidade de campanha para um totem (fonte única para mix, preview e ferramentas).
 * Mantém a mesma semântica que o dispatcher usa para candidatos (contrato + publishers + totem ativo).
 */

import { getDatabase } from '../config/database';
import { DISABLE_DIRECT_CAMPAIGN_TOTEM } from '../config/featureFlags';
import { logError } from '../utils/loggerHelper';

export class CampaignEligibilityService {
  private get db() {
    return getDatabase();
  }

  /**
   * Campanha ativa e elegível para o totem no “agora” (data de campanha + janela por totem quando forma 2 ativa).
   * Com DISABLE_DIRECT_CAMPAIGN_TOTEM=true: apenas via campaign_publishers + spa + totem ativo.
   */
  async isCampaignActiveForTotem(campaignId: number, totemId: number): Promise<boolean> {
    try {
      if (DISABLE_DIRECT_CAMPAIGN_TOTEM) {
        const result = await this.db.findFirst(
          `
                    SELECT 1
                    FROM campaigns c
                    INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
                    INNER JOIN subscriber_publisher_access_active spa
                      ON spa.subscriber_id = c.subscriber_id
                     AND spa.publisher_id = cp.publisher_id
                    INNER JOIN totems t ON t.totem_id = $2
                    INNER JOIN locals l ON l.local_id = t.local_id AND l.publisher_id = cp.publisher_id
                    WHERE c.campaign_id = $1
                      AND COALESCE(t.is_active, true) = true
                      AND cp.is_active = true
                      AND c.status = 'active'
                      AND c.is_active = true
                      AND (
                          (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
                          AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
                      )
                `,
          [campaignId, totemId]
        );
        return !!result;
      }
      const result = await this.db.findFirst(
        `
                SELECT 1
                FROM campaigns c
                INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
                INNER JOIN subscriber_publisher_access_active spa
                  ON spa.subscriber_id = c.subscriber_id
                 AND spa.publisher_id = cp.publisher_id
                INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
                INNER JOIN totems t_ct ON t_ct.totem_id = ct.totem_id
                WHERE c.campaign_id = $1
                  AND ct.totem_id = $2
                  AND COALESCE(t_ct.is_active, true) = true
                  AND cp.is_active = true
                  AND ct.is_active = true
                  AND c.status = 'active'
                  AND c.is_active = true
                  AND (
                      (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
                      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
                  )
                  AND (
                      (ct.start_date IS NULL OR ct.start_date <= CURRENT_DATE)
                      AND (ct.end_date IS NULL OR ct.end_date >= CURRENT_DATE)
                  )
            `,
        [campaignId, totemId]
      );
      return !!result;
    } catch (error: any) {
      await logError('Erro ao validar campanha ativa (eligibility)', error, { campaignId, totemId });
      return false;
    }
  }
}

let campaignEligibilityInstance: CampaignEligibilityService | null = null;

export function getCampaignEligibilityService(): CampaignEligibilityService {
  if (!campaignEligibilityInstance) {
    campaignEligibilityInstance = new CampaignEligibilityService();
  }
  return campaignEligibilityInstance;
}
