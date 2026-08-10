import { Request, Response, NextFunction } from 'express';
import { DEFERRED_FEATURES, DeferredFeatureId } from '../policy/deferredFeatures';

/**
 * Bloqueia rotas de features adiadas até implementação futura.
 */
export function requireFeatureNotDeferred(featureId: DeferredFeatureId) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const feature = DEFERRED_FEATURES[featureId];
    if (!feature) return next();
    return res.status(501).json({
      error: 'Feature adiada',
      code: 'FEATURE_DEFERRED',
      feature: feature.id,
      title: feature.title,
      reason: feature.reason,
      deferredUntil: feature.deferredUntil,
    });
  };
}
