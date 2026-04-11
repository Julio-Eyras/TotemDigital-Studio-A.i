/**
 * Helper para executar middlewares do express-validator em testes.
 * Usa o mesmo objeto req para que validationResult(req) leia os erros anexados.
 */

import { Request, Response } from 'express';

export type ValidationMiddleware = (req: Request, res: Response, next: () => void) => Promise<void> | void;

export async function runValidators(
  req: Partial<Request> & { body?: any; query?: any; params?: any },
  middlewares: ValidationMiddleware[]
): Promise<void> {
  const r = req as Request;
  if (r.body === undefined) r.body = {};
  if (r.query === undefined) r.query = {};
  if (r.params === undefined) r.params = {};
  const mockRes = {} as Response;
  const next = () => undefined;
  for (const mw of middlewares) {
    await Promise.resolve(mw(r, mockRes, next));
  }
}
