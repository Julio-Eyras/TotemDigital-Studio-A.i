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
  export function body(field: string): any;
  export function param(field: string): any;
  export function query(field: string): any;
  export function validationResult(req: any): any;
}

declare module 'express-rate-limit' {
  function rateLimit(options: any): any;
  export = rateLimit;
}

declare module 'sharp' {
  export default class Sharp {
    constructor(input?: any);
    resize(width?: number, height?: number): Sharp;
    jpeg(options?: any): Sharp;
    png(options?: any): Sharp;
    webp(options?: any): Sharp;
    toBuffer(): Promise<Buffer>;
    toFile(path: string): Promise<any>;
  }
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toBuffer(text: string, options?: any): Promise<Buffer>;
  export function toString(text: string, options?: any): Promise<string>;
}

declare module 'sqlite3' {
  export class Database {
    constructor(filename: string, callback?: (err: Error | null) => void);
    all(sql: string, params: any[], callback: (err: Error | null, rows: any[]) => void): void;
    get(sql: string, params: any[], callback: (err: Error | null, row: any) => void): void;
    run(sql: string, params: any[], callback?: (this: { lastID: number; changes: number }, err: Error | null) => void): void;
    exec(sql: string, callback?: (err: Error | null) => void): void;
    close(callback?: (err: Error | null) => void): void;
    backup(filename: string, callback?: (err: Error | null) => void): void;
  }
}

export {};
