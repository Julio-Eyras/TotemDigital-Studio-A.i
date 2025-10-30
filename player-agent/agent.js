#!/usr/bin/env node
/* SmartSignage SmartPlayer Agent (Node.js)
 * Funções: heartbeat, sync de playlist, download de mídias com cache e checksum
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function httpGet(url, headers = {}, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      } else {
        // coletar corpo mesmo com erro
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${data || ''}`)));
      }
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function httpDownload(url, destFile, headers = {}, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destFile);
    const req = client.get(url, { headers, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(true)));
      } else {
        fs.unlink(destFile, () => {});
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
    });
    req.on('error', (err) => {
      fs.unlink(destFile, () => {});
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      fs.unlink(destFile, () => {});
      reject(new Error('Download timeout'));
    });
  });
}

async function main() {
  const cfgPath = path.resolve(__dirname, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error('[Agent] ERRO: config.json não encontrado. Copie config.json.example e ajuste.');
    process.exit(1);
  }

  const cfg = readJSON(cfgPath);
  const {
    serverBaseUrl = 'http://localhost',
    playerId,
    token,
    mediaDir = path.resolve(__dirname, 'media-cache'),
    heartbeatIntervalSec = 30,
    syncIntervalSec = 60,
  } = cfg;

  if (!playerId || !token) {
    console.error('[Agent] ERRO: playerId e token são obrigatórios no config.json');
    process.exit(1);
  }

  ensureDir(mediaDir);

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function heartbeat() {
    try {
      const url = `${serverBaseUrl}/api/players/${playerId}/heartbeat`;
      const payload = {
        status: 'online',
        uptime: Math.floor(process.uptime()),
        memoryUsage: Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10,
        cpuUsage: 0,
      };
      await httpGet(url, { ...authHeaders, 'X-Payload': Buffer.from(JSON.stringify(payload)).toString('base64') });
      console.log('[Agent] Heartbeat OK');
    } catch (err) {
      console.warn('[Agent] Heartbeat falhou:', err.message);
    }
  }

  async function syncPlaylist() {
    try {
      const url = `${serverBaseUrl}/api/players/${playerId}/playlist`;
      const res = await httpGet(url, authHeaders);
      const json = JSON.parse(res.data || '{}');
      const items = json.items || json.media || [];
      for (const it of items) {
        const fileUrl = it.filePath || it.file_url || it.url;
        if (!fileUrl) continue;
        const filename = path.basename(fileUrl.split('?')[0]);
        const target = path.join(mediaDir, filename);
        const expectedChecksum = it.checksum || it.sha256;
        let needDownload = !fs.existsSync(target);
        if (!needDownload && expectedChecksum) {
          try {
            const sum = await sha256File(target);
            if (sum.toLowerCase() !== expectedChecksum.toLowerCase()) {
              console.log('[Agent] Checksum divergente, rebaixando', filename);
              needDownload = true;
            }
          } catch (_) {
            needDownload = true;
          }
        }
        if (needDownload) {
          console.log('[Agent] Baixando', fileUrl, '=>', target);
          await httpDownload(fileUrl.startsWith('http') ? fileUrl : `${serverBaseUrl}${fileUrl}`, target);
        }
      }
      console.log('[Agent] Sync OK');
    } catch (err) {
      console.warn('[Agent] Sync falhou:', err.message);
    }
  }

  // Ciclos
  await syncPlaylist();
  await heartbeat();
  setInterval(syncPlaylist, syncIntervalSec * 1000).unref();
  setInterval(heartbeat, heartbeatIntervalSec * 1000).unref();
}

main().catch((e) => {
  console.error('[Agent] Fatal:', e);
  process.exit(1);
});


