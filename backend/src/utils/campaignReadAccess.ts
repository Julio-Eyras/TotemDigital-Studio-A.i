/**
 * Autorização de leitura por campanha (listagens / rotas por campaign_id).
 */
import { Request } from 'express';
import { getCampaignService } from '../services/campaignService';
import { isAdminRole } from './tenantScope';
import { isSubscriberTenantRole, resolvePublisherIdFromRequest } from './tenantClientAccess';

interface CampaignAccessError extends Error {
  statusCode?: number;
}

export async function assertCampaignReadAccess(req: Request, campaignId: number): Promise<void> {
  if (isAdminRole(req.user?.role)) {
    return;
  }

  const campaign = await getCampaignService().getCampaignById(campaignId);
  if (!campaign) {
    const err = new Error('Campanha não encontrada') as CampaignAccessError;
    err.statusCode = 404;
    throw err;
  }

  if (isSubscriberTenantRole(req)) {
    const sid = req.subscriberId ?? req.user?.subscriberId ?? req.user?.clientId;
    if (sid == null || Number(campaign.subscriberId) !== Number(sid)) {
      const err = new Error('Acesso negado') as CampaignAccessError;
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  const pubId = await resolvePublisherIdFromRequest(req);
  if (pubId == null) {
    return;
  }

  const ok = await getCampaignService().isCampaignVisibleToPublisher(campaignId, pubId);
  if (!ok) {
    const err = new Error('Acesso negado') as CampaignAccessError;
    err.statusCode = 403;
    throw err;
  }
}
