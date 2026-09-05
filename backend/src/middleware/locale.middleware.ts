// Middleware: Detecta locale por query ?lang= | header Accept-Language | subdomínio
// Injeta req.locale e req.t (helper tipado para traduções).

import { Request, Response, NextFunction } from 'express';
import { detectLocale, t, SUPPORTED_LANGUAGES } from '../config/i18n';

declare global {
  namespace Express {
    interface Request {
      locale?: string;
      t?: (key: string, params?: Record<string, string | number | boolean | undefined>) => string;
    }
  }
}

export function localeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const detected = detectLocale({
    query: req.query as Record<string, unknown> | undefined,
    headers: req.headers as Record<string, string | string[] | undefined>,
    subdomains: (req as unknown as { subdomains?: string[] }).subdomains,
    locale: req.locale
  });
  req.locale = detected;
  req.t = (key: string, params?) => t(key, { lng: detected, params });
  res.setHeader('Content-Language', detected);
  next();
}

export const localeMiddlewareSafe = localeMiddleware;
export default localeMiddleware;
export { SUPPORTED_LANGUAGES };
