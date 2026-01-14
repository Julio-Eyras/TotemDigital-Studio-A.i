/**
 * LocalHttpServer - Linux/Windows
 * Servidor HTTP local para totens servirem mídias às Smart TVs associadas
 * 
 * Implementa servidor HTTP simples na porta 8080 (configurável)
 * Usa Node.js http module
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

class LocalHttpServer {
    constructor(options = {}) {
        this.port = options.port || 8080;
        this.cacheDir = options.cacheDir || path.join(__dirname, '../cache/media');
        this.server = null;
        this.isRunning = false;
        
        // Criar diretório de cache se não existir
        this.ensureCacheDir();
    }

    /**
     * Garante que diretório de cache existe
     */
    async ensureCacheDir() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.error('[LocalHttpServer] Erro ao criar diretório de cache', error);
        }
    }

    /**
     * Inicia o servidor HTTP local
     */
    start() {
        if (this.isRunning) {
            console.warn('[LocalHttpServer] Servidor já está em execução');
            return;
        }

        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.port, '0.0.0.0', () => {
            this.isRunning = true;
            console.log(`[LocalHttpServer] Servidor HTTP local iniciado na porta ${this.port}`);
            console.log(`[LocalHttpServer] Acesse em: http://localhost:${this.port}`);
        });

        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`[LocalHttpServer] Porta ${this.port} já está em uso`);
            } else {
                console.error('[LocalHttpServer] Erro no servidor', error);
            }
            this.isRunning = false;
        });
    }

    /**
     * Para o servidor HTTP local
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        this.server.close(() => {
            console.log('[LocalHttpServer] Servidor HTTP local parado');
        });
    }

    /**
     * Processa requisição HTTP
     */
    async handleRequest(req, res) {
        try {
            const parsedUrl = url.parse(req.url, true);
            const pathname = parsedUrl.pathname;
            const method = req.method;

            console.log(`[LocalHttpServer] Requisição: ${method} ${pathname}`);

            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            if (pathname.startsWith('/media/')) {
                await this.serveMedia(pathname, req, res);
            } else if (pathname === '/health') {
                this.serveHealth(res);
            } else {
                this.serve404(res);
            }
        } catch (error) {
            console.error('[LocalHttpServer] Erro ao processar requisição', error);
            this.serve500(res);
        }
    }

    /**
     * Serve arquivo de mídia do cache
     */
    async serveMedia(pathname, req, res) {
        try {
            // Extrair mediaId do path (ex: /media/123_abc123.mp4)
            const fileName = pathname.split('/').pop();
            const mediaId = fileName.split('_').shift();

            if (!mediaId || isNaN(mediaId)) {
                this.serve404(res);
                return;
            }

            // Construir caminho do arquivo
            const filePath = path.join(this.cacheDir, fileName);

            // Verificar se arquivo existe
            try {
                await fs.access(filePath);
            } catch (error) {
                this.serve404(res);
                return;
            }

            // Obter estatísticas do arquivo
            const stats = await fs.stat(filePath);
            const fileSize = stats.size;

            // Determinar MIME type
            const ext = path.extname(fileName).toLowerCase();
            const mimeType = this.getMimeType(ext);

            // Suportar Range requests (para streaming)
            const range = req.headers.range;
            let start = 0;
            let end = fileSize - 1;

            if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                start = parseInt(parts[0], 10);
                end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            }

            const chunkSize = (end - start) + 1;

            // Headers de resposta
            const headers = {
                'Content-Type': mimeType,
                'Content-Length': chunkSize,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000',
                'Content-Range': `bytes ${start}-${end}/${fileSize}`
            };

            if (range) {
                res.writeHead(206, headers);
            } else {
                res.writeHead(200, headers);
            }

            // Criar stream de leitura
            const fileStream = require('fs').createReadStream(filePath, { start, end });
            fileStream.pipe(res);

            console.log(`[LocalHttpServer] Mídia servida: ${fileName} (${start}-${end}/${fileSize})`);

        } catch (error) {
            console.error('[LocalHttpServer] Erro ao servir mídia', error);
            this.serve500(res);
        }
    }

    /**
     * Serve endpoint de health check
     */
    serveHealth(res) {
        const response = JSON.stringify({
            status: 'ok',
            totemUIN: process.env.TOTEM_UIN || 'TOTEM_LOCAL',
            version: '2.1.0',
            timestamp: Date.now(),
            cacheDir: this.cacheDir,
            port: this.port,
            cacheSize: this.getCacheSizeSync()
        });

        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(response);
    }
    
    /**
     * Obtém tamanho do cache (síncrono)
     */
    getCacheSizeSync() {
        try {
            const fs = require('fs');
            const files = fs.readdirSync(this.cacheDir);
            return files.reduce((sum, file) => {
                const filePath = require('path').join(this.cacheDir, file);
                try {
                    return sum + fs.statSync(filePath).size;
                } catch (e) {
                    return sum;
                }
            }, 0);
        } catch (error) {
            return 0;
        }
    }

    /**
     * Serve erro 404
     */
    serve404(res) {
        const response = JSON.stringify({ error: 'Not Found' });
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(response);
    }

    /**
     * Serve erro 500
     */
    serve500(res) {
        const response = JSON.stringify({ error: 'Internal Server Error' });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(response);
    }

    /**
     * Obtém MIME type pela extensão
     */
    getMimeType(ext) {
        const mimeMap = {
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
        return mimeMap[ext.toLowerCase()] || 'application/octet-stream';
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
                    return `http://${iface.address}:${this.port}`;
                }
            }
        }
        
        return `http://localhost:${this.port}`;
    }

    /**
     * Verifica se servidor está rodando
     */
    isServerRunning() {
        return this.isRunning;
    }
}

// Se executado diretamente, iniciar servidor
if (require.main === module) {
    const server = new LocalHttpServer({
        port: process.env.PORT || 8080,
        cacheDir: process.env.CACHE_DIR || path.join(__dirname, '../cache/media')
    });
    
    server.start();
    
    // Parar graciosamente ao receber SIGTERM ou SIGINT
    process.on('SIGTERM', () => {
        console.log('[LocalHttpServer] Recebido SIGTERM, parando servidor...');
        server.stop();
        process.exit(0);
    });
    
    process.on('SIGINT', () => {
        console.log('[LocalHttpServer] Recebido SIGINT, parando servidor...');
        server.stop();
        process.exit(0);
    });
}

module.exports = LocalHttpServer;
