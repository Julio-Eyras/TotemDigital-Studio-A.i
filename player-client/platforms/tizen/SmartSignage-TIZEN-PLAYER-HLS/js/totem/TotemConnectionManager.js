/**
 * TotemConnectionManager - Tizen
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
            // Tentar SSDP primeiro (Tizen tem melhor suporte)
            const ssdpTotem = await this.discoverViaSSDP();
            if (ssdpTotem) return ssdpTotem;

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
            // Obter IP local da TV via Tizen Network API
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
     * Obtém IP local da TV via Tizen Network API
     */
    async getLocalIP() {
        try {
            if (typeof tizen !== 'undefined' && tizen.network) {
                const networkInfo = tizen.network.getActiveNetworkType();
                const networkService = tizen.network.getNetworkService(networkInfo);
                
                if (networkService && networkService.ipAddress) {
                    return networkService.ipAddress;
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
        try {
            const url = `http://${ip}:${port}/health`;
            
            // Tizen fetch com timeout
            const response = await Promise.race([
                fetch(url, { method: 'GET' }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), this.discoveryTimeout)
                )
            ]);

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
            const response = await fetch(url);
            
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
