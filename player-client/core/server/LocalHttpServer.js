/**
 * Local HTTP Server - Core
 * Servidor HTTP local para totens servirem mídias às Smart TVs associadas
 * 
 * Este módulo implementa:
 * - Servidor HTTP simples na porta 8080 (configurável)
 * - Servir mídias do cache local
 * - Endpoint para DispatchPlan (opcional)
 * - Suporte a range requests para streaming parcial
 */

class LocalHttpServer {
  constructor(options = {}) {
    this.config = {
      port: options.port || 8080,
      host: options.host || '0.0.0.0', // Escutar em todas as interfaces
      cacheDir: options.cacheDir || './cache',
      mediaDownloader: options.mediaDownloader || null,
      apiClient: options.apiClient || null,
      ...options
    };

    this.server = null;
    this.isRunning = false;
  }

  /**
   * Inicia o servidor HTTP local
   */
  async start() {
    if (this.isRunning) {
      console.warn('[LocalHttpServer] Servidor já está em execução');
      return;
    }

    try {
      // Verificar se estamos em ambiente Node.js
      if (typeof require === 'undefined') {
        console.warn('[LocalHttpServer] Ambiente não suportado (requer Node.js)');
        return;
      }

      const http = require('http');
      const fs = require('fs').promises;
      const path = require('path');
      const url = require('url');

      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res, { fs, path, url });
        } catch (error) {
          console.error('[LocalHttpServer] Erro ao processar requisição:', error);
          this.sendError(res, 500, 'Internal Server Error');
        }
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(`[LocalHttpServer] Servidor iniciado em http://${this.config.host}:${this.config.port}`);
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`[LocalHttpServer] Porta ${this.config.port} já está em uso`);
        } else {
          console.error('[LocalHttpServer] Erro no servidor:', error);
        }
        this.isRunning = false;
      });

    } catch (error) {
      console.error('[LocalHttpServer] Erro ao iniciar servidor:', error);
      throw error;
    }
  }

  /**
   * Para o servidor HTTP local
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        console.log('[LocalHttpServer] Servidor parado');
        resolve();
      });
    });
  }

  /**
   * Processa requisição HTTP
   */
  async handleRequest(req, res, { fs, path, url }) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    // OPTIONS request (CORS preflight)
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Rotas
    if (pathname.startsWith('/media/')) {
      await this.serveMedia(req, res, pathname, { fs, path });
    } else if (pathname === '/api/dispatch' && this.config.apiClient) {
      await this.serveDispatchPlan(req, res, parsedUrl.query);
    } else if (pathname === '/health') {
      this.sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    } else {
      this.sendError(res, 404, 'Not Found');
    }
  }

  /**
   * Serve arquivo de mídia do cache
   */
  async serveMedia(req, res, pathname, { fs, path }) {
    try {
      // Extrair mediaId do path (ex: /media/123_abc123.mp4)
      const fileName = pathname.replace('/media/', '');
      const mediaId = fileName.split('_')[0]; // Assumir formato: {mediaId}_{checksum}.{ext}

      // Construir caminho do arquivo
      const filePath = path.join(this.config.cacheDir, 'media', fileName);

      // Verificar se arquivo existe
      try {
        await fs.access(filePath);
      } catch {
        this.sendError(res, 404, 'Media file not found');
        return;
      }

      // Obter estatísticas do arquivo
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Determinar MIME type pela extensão
      const ext = path.extname(fileName).toLowerCase();
      const mimeType = this.getMimeType(ext);

      // Suporte a Range requests (streaming parcial)
      const range = req.headers.range;
      
      if (range) {
        await this.serveRangeRequest(req, res, filePath, fileSize, mimeType, range, { fs });
      } else {
        // Servir arquivo completo
        const fileStream = require('fs').createReadStream(filePath);
        
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000' // Cache por 1 ano
        });

        fileStream.pipe(res);
      }

    } catch (error) {
      console.error('[LocalHttpServer] Erro ao servir mídia:', error);
      this.sendError(res, 500, 'Error serving media');
    }
  }

  /**
   * Serve requisição com Range (streaming parcial)
   */
  async serveRangeRequest(req, res, filePath, fileSize, mimeType, rangeHeader, { fs }) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;

    const fileStream = require('fs').createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType
    });

    fileStream.pipe(res);
  }

  /**
   * Serve DispatchPlan (opcional, para TVs consultarem diretamente)
   */
  async serveDispatchPlan(req, res, query) {
    try {
      const { uin } = query;

      if (!uin) {
        this.sendError(res, 400, 'UIN parameter required');
        return;
      }

      // Obter último DispatchPlan do MediaDownloader
      if (this.config.mediaDownloader) {
        const lastPlan = await this.config.mediaDownloader.loadLastDispatchPlan();
        if (lastPlan) {
          this.sendJson(res, 200, {
            success: true,
            plan: lastPlan,
            fromCache: true
          });
          return;
        }
      }

      // Tentar obter do API client se disponível
      if (this.config.apiClient) {
        try {
          const token = this.config.apiClient.token || await this.config.apiClient.generateTotemToken();
          const plan = await this.config.apiClient.getDispatchPlan(uin, token);
          this.sendJson(res, 200, {
            success: true,
            plan,
            fromCache: false
          });
          return;
        } catch (error) {
          console.error('[LocalHttpServer] Erro ao obter DispatchPlan:', error);
        }
      }

      this.sendError(res, 503, 'DispatchPlan not available');

    } catch (error) {
      console.error('[LocalHttpServer] Erro ao servir DispatchPlan:', error);
      this.sendError(res, 500, 'Error serving DispatchPlan');
    }
  }

  /**
   * Obtém MIME type pela extensão
   */
  getMimeType(ext) {
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Envia resposta JSON
   */
  sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Envia erro HTTP
   */
  sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * Obtém URL base do servidor
   */
  getBaseUrl() {
    // Tentar detectar IP local
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return `http://${iface.address}:${this.config.port}`;
        }
      }
    }

    return `http://localhost:${this.config.port}`;
  }

  /**
   * Verifica se servidor está rodando
   */
  isServerRunning() {
    return this.isRunning;
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalHttpServer;
} else {
  // Browser/WebOS/Tizen não suportam servidor HTTP
  console.warn('[LocalHttpServer] Servidor HTTP local requer Node.js');
  window.LocalHttpServer = null;
}
