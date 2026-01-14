/**
 * TotemConnectionManager - webOS
 * Gerencia descoberta e conexão com totem local vs servidor central
 */

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

        // 2. Tentar descoberta automática
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
            if (typeof webOS !== 'undefined' && webOS.service) {
                const mdnsTotem = await this.discoverViaMDNS();
                if (mdnsTotem) return mdnsTotem;
            }

            // Tentar SSDP
            const ssdpTotem = await this.discoverViaSSDP();
            if (ssdpTotem) return ssdpTotem;

            // Tentar varredura de rede local (último recurso)
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
            if (typeof webOS === 'undefined' || !webOS.service) {
                return null;
            }

            // webOS mDNS service
            return new Promise((resolve) => {
                webOS.service.request('luna://com.webos.service.mdns', {
                    method: 'discover',
                    params: {
                        service: '_smartsignage-totem._tcp.local',
                        timeout: this.discoveryTimeout / 1000
                    },
                    onSuccess: (response) => {
                        if (response.services && response.services.length > 0) {
                            const service = response.services[0];
                            resolve({
                                ip: service.ip,
                                port: service.port || 8080,
                                uin: service.txt?.totemUIN || null,
                                type: 'mdns'
                            });
                        } else {
                            resolve(null);
                        }
                    },
                    onFailure: () => resolve(null)
                });
            });
        } catch (error) {
            console.warn('[TotemConnectionManager] Erro mDNS', error);
            return null;
        }
    }

    /**
     * Descobre totem via SSDP
     */
    async discoverViaSSDP() {
        try {
            // SSDP requer implementação específica de UDP multicast
            // Por enquanto, retornar null (implementar se necessário)
            return null;
        } catch (error) {
            console.warn('[TotemConnectionManager] Erro SSDP', error);
            return null;
        }
    }

    /**
     * Varre rede local procurando totem
     */
    async scanLocalNetwork() {
        try {
            // Obter IP local da TV
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
     * Obtém IP local da TV
     */
    async getLocalIP() {
        try {
            if (typeof webOS !== 'undefined' && webOS.service) {
                return new Promise((resolve) => {
                    webOS.service.request('luna://com.webos.service.connectionmanager', {
                        method: 'getStatus',
                        onSuccess: (response) => {
                            const ip = response?.ipAddress || null;
                            resolve(ip);
                        },
                        onFailure: () => resolve(null)
                    });
                });
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
        try {
            const url = `http://${ip}:${port}/health`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.discoveryTimeout);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                // Verificar se é realmente um totem SmartSignage
                return data.status === 'ok' && (data.totemUIN !== undefined || data.version !== undefined);
            }

            return false;
        } catch (error) {
            // Timeout ou erro de conexão
            return false;
        }
    }

    /**
     * Obtém UIN do totem via health check
     */
    async getTotemUIN(ip, port) {
        try {
            const url = `http://${ip}:${port}/health`;
            const response = await fetch(url, { timeout: 2000 });
            
            if (response.ok) {
                const data = await response.json();
                return data.totemUIN || null;
            }
            return null;
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

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TotemConnectionManager;
} else {
    window.TotemConnectionManager = TotemConnectionManager;
}
