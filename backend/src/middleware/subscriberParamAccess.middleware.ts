import { Request, Response, NextFunction } from 'express';
import { assertTenantClientParamAccess } from '../utils/tenantClientAccess';

/**
 * Garante que :subscriberId na rota pertence ao tenant do usuário autenticado.
 */
export async function assertSubscriberParamAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const raw = (req.params as { subscriberId?: string }).subscriberId;
    const subscriberId = Number(raw);
    if (!raw || Number.isNaN(subscriberId) || subscriberId < 1) {
      res.status(400).json({ success: false, error: 'subscriberId inválido' });
      return;
    }
    await assertTenantClientParamAccess(req, subscriberId);
    next();
  } catch (error: any) {
    const status = error?.statusCode === 403 ? 403 : 500;
    res.status(status).json({
      success: false,
      error: error?.message || 'Acesso negado',
    });
  }
}
