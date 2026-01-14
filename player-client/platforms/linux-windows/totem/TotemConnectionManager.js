/**
 * TotemConnectionManager - Linux/Windows
 * Gerencia descoberta e conexão com totem local vs servidor central
 * 
 * Nota: Linux/Windows geralmente são totens, mas podem se conectar a outros totens se necessário
 */

const http = require('http');
const dns = require('dns').promises;

class TotemConnectionManager {
    constructor(config) {
        this.config = config || {};
        this.totemInfo = null;
        this.useLocalTotem = false;
        this.discoveryTimeout = this.config.discoveryTimeout || 5000;
    }

    /**
     * Determina estratégia de conexão (totem local ou servidor central)
     */
    async determineConnectionStrategy() {
        console.log('[TotemConnectionManager] Determinando estratégia de conexão...');

        // 1. Verificar configuração manual
        if (this.config.totemIP) {
            console.log(`[TotemConnectionManager] Tentando totem configurado: ${this.config.totemIP}`);
            const available = await this.testTotemConnection(
                this.config.totemIP,
                this.config.totemPort || 8080
            );

            if (available) {
                this.totemInfo = {
                    ip: this.config.totemIP,
                    port: this.config.totemPort || 8080,
                    uin: this.config.totemUIN,
                    type: 'configured'
                };
                this.useLocalTotem = true;
                console.log('[TotemConnectionManager] Totem local configurado disponível');
                return { useLocalTotem: true, totemInfo: this.totemInfo };
            }
        }

        // 2. Tentar descoberta automática (mDNS/Bonjour)
        if (this.config.autoDiscovery !== false) {
            console.log('[TotemConnectionManager] Tentando descoberta automática...');
            const discoveredTotem = await this.discoverTotem();

            if (discoveredTotem) {
                const available = await this.testTotemConnection(
                    discoveredTotem.ip,
                    discoveredTotem.port
                );

                if (available) {
                    this.totemInfo = discoveredTotem;
                    this.useLocalTotem = true;
                    console.log('[TotemConnectionManager] Totem local descoberto automaticamente');
                    return { useLocalTotem: true, totemInfo: this.totemInfo };
                }
            }
        }

        // 3. Fallback: servidor central
        console.log('[TotemConnectionManager] Usando servidor central (fallback)');
        this.useLocalTotem = false;
        return { useLocalTotem: false, totemInfo: null };
    }

    /**
     * Descobre totem na rede local
     */
    async discoverTotem() {
        try {
            // Tentar mDNS/Bonjour primeiro
            const mdnsTotem = await this.discoverViaMDNS();
            if (mdnsTotem) return mdnsTotem;

            // Tentar varredura de rede local
            const scanTotem = await this.scanLocalNetwork();
            if (scanTotem) return scanTotem;

            return null;
        } catch (error) {
            console.warn('[TotemConnectionManager] Erro na descoberta', error);
            return null;
        }
    }

    /**
     * Descobre totem via mDNS/Bonjour
     */
    async discoverViaMDNS() {
        try {
            // Tentar resolver _smartsignage-totem._tcp.local usando avahi-browse
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            try {
                // Usar avahi-browse para descobrir serviços
                const { stdout } = await execAsync('avahi-browse -rt _smartsignage-totem._tcp', {
                    timeout: this.discoveryTimeout
                });
                
                // Parsear saída do avahi-browse
                // Formato: =;wlan0;IPv4;Publisher-totem23;_smartsignage-totem._tcp;local;totem23.local;8080;
                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (line.startsWith('=') && line.includes('_smartsignage-totem._tcp')) {
                        const parts = line.split(';');
                        if (parts.length >= 8) {
                            const hostname = parts[6]; // totem23.local
                            const port = parseInt(parts[7]) || 8080;
                            
                            // Resolver IP do hostname
                            const dns = require('dns').promises;
                            try {
                                const addresses = await dns.resolve4(hostname);
                                if (addresses.length > 0) {
                                    return {
                                        ip: addresses[0],
                                        port: port,
                                        hostname: hostname,
                                        type: 'mdns'
                                    };
                                }
                            } catch (dnsError) {
                                console.warn('[TotemConnectionManager] Erro ao resolver hostname mDNS', dnsError);
                            }
                        }
                    }
                }
            } catch (execError) {
                // avahi-browse não disponível ou timeout
                console.warn('[TotemConnectionManager] avahi-browse não disponível ou timeout');
            }
            
            return null;
        } catch (error) {
            console.warn('[TotemConnectionManager] Erro mDNS', error);
            return null;
        }
    }

    /**
     * Varre rede local procurando totem
     */
    async scanLocalNetwork() {
        try {
            // Obter IP local
            const localIP = await this.getLocalIP();
            if (!localIP) return null;

            // Extrair subnet (ex: 192.168.1.x)
            const subnet = localIP.substring(0, localIP.lastIndexOf('.'));
            
            // Testar IPs comuns na subnet (1-10)
            const testIPs = [];
            for (let i = 1; i <= 10; i++) {
                testIPs.push(`${subnet}.${i}`);
            }

            // Testar cada IP em paralelo
            const promises = testIPs.map(ip => 
                this.testTotemConnection(ip, 8080).then(available => 
                    available ? { ip, port: 8080 } : null
                )
            );

            const results = await Promise.all(promises);
            const found = results.find(r => r !== null);
            
            if (found) {
                // Obter UIN do totem
                const uin = await this.getTotemUIN(found.ip, found.port);
                return {
                    ip: found.ip,
                    port: found.port,
                    uin: uin,
                    type: 'scanned'
                };
            }

            return null;
        } catch (error) {
            console.warn('[TotemConnectionManager] Erro ao varrer rede', error);
            return null;
        }
    }

    /**
     * Obtém IP local
     */
    async getLocalIP() {
        try {
            const os = require('os');
            const interfaces = os.networkInterfaces();
            
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        return iface.address;
                    }
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Testa conexão com totem
     */
    async testTotemConnection(ip, port) {
        return new Promise((resolve) => {
            const url = `http://${ip}:${port}/health`;
            const req = http.get(url, { timeout: this.discoveryTimeout }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.status === 'ok' && (json.totemUIN !== undefined || json.version !== undefined));
                    } catch (e) {
                        resolve(false);
                    }
                });
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Obtém UIN do totem via health check
     */
    async getTotemUIN(ip, port) {
        try {
            const url = `http://${ip}:${port}/health`;
            const req = http.get(url, { timeout: 2000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        return json.totemUIN || null;
                    } catch (e) {
                        return null;
                    }
                });
            });
            
            req.on('error', () => null);
        } catch (error) {
            return null;
        }
    }

    /**
     * Obtém URL base para requisições
     */
    getBaseURL() {
        if (this.useLocalTotem && this.totemInfo) {
            return `http://${this.totemInfo.ip}:${this.totemInfo.port}`;
        }
        return this.config.apiBaseURL || 'http://localhost:3000';
    }

    /**
     * Obtém UIN do totem (local ou remoto)
     */
    getTotemUIN() {
        if (this.useLocalTotem && this.totemInfo) {
            return this.totemInfo.uin || this.config.totemUIN;
        }
        return this.config.totemUIN;
    }

    /**
     * Verifica se está usando totem local
     */
    isUsingLocalTotem() {
        return this.useLocalTotem;
    }

    /**
     * Obtém informações do totem
     */
    getTotemInfo() {
        return this.totemInfo;
    }
}

module.exports = TotemConnectionManager;
