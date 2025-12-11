/**
 * Tipos globais para Smart Signage Pro v2.0
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        role: string;
        clientId?: number;
      };
    }
  }
}

// Extensões de módulos
declare module 'express-validator' {
  import { Request, ValidationChain } from 'express-validator';
  
  export function body(field: string): ValidationChain;
  export function param(field: string): ValidationChain;
  export function query(field: string): ValidationChain;
  export function validationResult(req: Request): {
    isEmpty(): boolean;
    array(): Array<{ msg: string; param: string; location: string }>;
  };
}

declare module 'express-rate-limit' {
  import { Request, Response } from 'express';
  
  interface RateLimitOptions {
    windowMs?: number;
    max?: number;
    message?: string | object;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skip?: (req: Request) => boolean;
    keyGenerator?: (req: Request) => string;
  }
  
  function rateLimit(options?: RateLimitOptions): (req: Request, res: Response, next: () => void) => void;
  export = rateLimit;
}

declare module 'sharp' {
  interface SharpOptions {
    quality?: number;
    progressive?: boolean;
  }
  
  export default class Sharp {
    constructor(input?: Buffer | string);
    resize(width?: number, height?: number): Sharp;
    jpeg(options?: SharpOptions): Sharp;
    png(options?: SharpOptions): Sharp;
    webp(options?: SharpOptions): Sharp;
    toBuffer(): Promise<Buffer>;
    toFile(path: string): Promise<{ size: number; format: string }>;
  }
}

declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
  
  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  export function toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>;
  export function toString(text: string, options?: QRCodeOptions): Promise<string>;
}

// SQLite removido na v2.1 - apenas PostgreSQL suportado
// Módulo sqlite3 não é mais usado ou necessário

export {};
