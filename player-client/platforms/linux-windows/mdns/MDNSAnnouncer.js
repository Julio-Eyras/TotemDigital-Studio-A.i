/**
 * MDNSAnnouncer - Linux/Windows
 * Anuncia totem via mDNS (Avahi) para descoberta automática por Smart TVs
 * 
 * Requer: avahi-daemon instalado (sudo apt install avahi-daemon avahi-utils)
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class MDNSAnnouncer {
    constructor(options = {}) {
        this.totemUIN = options.totemUIN || '';
        this.port = options.port || 8080;
        this.hostname = os.hostname();
        this.serviceFile = '/etc/avahi/services/smartdisplay.service';
        this.platform = process.platform === 'win32' ? 'windows' : 'linux';
        this.version = options.version || '2.1.0';
        
        // Verificar se está rodando como root (necessário para escrever em /etc/avahi)
        this.isRoot = process.getuid && process.getuid() === 0;
    }

    /**
     * Cria arquivo de serviço Avahi
     */
    async createServiceFile() {
        try {
            // Verificar se Avahi está instalado
            await this.checkAvahiInstalled();
            
            // Criar conteúdo XML do serviço
            const xml = this.generateServiceXML();
            
            // Tentar criar arquivo
            if (this.isRoot) {
                await fs.writeFile(this.serviceFile, xml, { mode: 0o644 });
                console.log('[MDNS] Arquivo de serviço criado:', this.serviceFile);
                
                // Reiniciar Avahi para aplicar mudanças
                await this.restartAvahi();
                return true;
            } else {
                // Tentar com sudo
                console.warn('[MDNS] Não está rodando como root, tentando com sudo...');
                const tempFile = `/tmp/smartdisplay-${Date.now()}.service`;
                await fs.writeFile(tempFile, xml);
                
                try {
                    await execAsync(`sudo cp ${tempFile} ${this.serviceFile}`);
                    await execAsync(`sudo chmod 644 ${this.serviceFile}`);
                    await fs.unlink(tempFile);
                    
                    console.log('[MDNS] Arquivo de serviço criado via sudo:', this.serviceFile);
                    await this.restartAvahi();
                    return true;
                } catch (sudoError) {
                    await fs.unlink(tempFile).catch(() => {});
                    console.warn('[MDNS] Falha ao criar arquivo com sudo. Pode precisar de permissões:', sudoError.message);
                    console.warn('[MDNS] Totem ainda funcionará, mas não será descoberto via mDNS');
                    return false;
                }
            }
        } catch (error) {
            console.error('[MDNS] Erro ao criar arquivo de serviço:', error);
            console.warn('[MDNS] Totem ainda funcionará, mas não será descoberto via mDNS');
            return false;
        }
    }

    /**
     * Gera XML do serviço Avahi
     */
    generateServiceXML() {
        const serviceName = `Publisher-${this.hostname}`;
        
        return `<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">${serviceName}</name>
  <service>
    <type>_smartsignage-totem._tcp</type>
    <port>${this.port}</port>
    <txt-record>role=publisher</txt-record>
    <txt-record>player=${this.platform}</txt-record>
    <txt-record>version=${this.version}</txt-record>
    <txt-record>totemUIN=${this.totemUIN}</txt-record>
  </service>
</service-group>`;
    }

    /**
     * Verifica se Avahi está instalado
     */
    async checkAvahiInstalled() {
        try {
            await execAsync('which avahi-daemon');
            return true;
        } catch (error) {
            console.warn('[MDNS] Avahi não está instalado. Instale com: sudo apt install avahi-daemon avahi-utils');
            throw new Error('Avahi não está instalado');
        }
    }

    /**
     * Reinicia Avahi daemon
     */
    async restartAvahi() {
        try {
            if (this.isRoot) {
                await execAsync('systemctl restart avahi-daemon');
            } else {
                await execAsync('sudo systemctl restart avahi-daemon');
            }
            console.log('[MDNS] Avahi reiniciado com sucesso');
        } catch (error) {
            console.warn('[MDNS] Erro ao reiniciar Avahi (pode não ser crítico):', error.message);
            // Não lançar erro, Avahi pode já estar rodando com configuração correta
        }
    }

    /**
     * Remove arquivo de serviço
     */
    async removeServiceFile() {
        try {
            if (this.isRoot) {
                await fs.unlink(this.serviceFile);
            } else {
                await execAsync(`sudo rm ${this.serviceFile}`);
            }
            await this.restartAvahi();
            console.log('[MDNS] Serviço removido');
        } catch (error) {
            console.warn('[MDNS] Erro ao remover serviço:', error.message);
        }
    }

    /**
     * Verifica se serviço está ativo
     */
    async isServiceActive() {
        try {
            await fs.access(this.serviceFile);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Obtém informações do serviço registrado
     */
    async getServiceInfo() {
        try {
            const { stdout } = await execAsync('avahi-browse -rt _smartsignage-totem._tcp');
            return stdout;
        } catch (error) {
            return null;
        }
    }
}

module.exports = MDNSAnnouncer;
