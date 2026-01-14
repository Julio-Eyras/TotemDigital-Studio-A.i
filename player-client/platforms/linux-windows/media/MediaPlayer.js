/**
 * MediaPlayer - Linux/Windows
 * Player de mídia multiplataforma usando bibliotecas nativas
 * 
 * Suporta DispatchPlanMediaItem diretamente
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');

class MediaPlayer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.platform = options.platform || process.platform;
        this.currentProcess = null;
        this.currentMediaItem = null;
    }

    /**
     * Reproduz item de mídia do DispatchPlan
     */
    async play(mediaItem, url) {
        try {
            this.currentMediaItem = mediaItem;
            
            // Determinar URL final (usar url fornecido ou mediaItem.url)
            const finalUrl = url || mediaItem.url;
            
            switch (mediaItem.mediaType.toLowerCase()) {
                case 'video':
                    await this.playVideo(finalUrl, mediaItem.duration);
                    break;
                case 'image':
                    await this.playImage(finalUrl, mediaItem.duration || 10);
                    break;
                case 'html':
                case 'web':
                    await this.playHTML(finalUrl, mediaItem.duration || 30);
                    break;
                default:
                    throw new Error(`Tipo de mídia não suportado: ${mediaItem.mediaType}`);
            }
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Reproduz vídeo
     */
    async playVideo(url, durationSeconds) {
        return new Promise((resolve, reject) => {
            // Determinar player baseado na plataforma
            let playerCommand;
            let playerArgs;
            
            if (this.platform === 'win32') {
                // Windows: usar VLC ou Windows Media Player
                // Tentar VLC primeiro
                playerCommand = 'vlc';
                playerArgs = [
                    '--fullscreen',
                    '--no-video-title-show',
                    '--quiet',
                    url
                ];
            } else {
                // Linux: usar VLC ou mpv
                playerCommand = 'vlc';
                playerArgs = [
                    '--fullscreen',
                    '--no-video-title-show',
                    '--quiet',
                    url
                ];
            }
            
            // Iniciar processo do player
            this.currentProcess = spawn(playerCommand, playerArgs, {
                stdio: 'ignore',
                detached: true
            });
            
            // Se duração especificada, agendar término
            if (durationSeconds) {
                setTimeout(() => {
                    this.stop();
                    resolve();
                }, durationSeconds * 1000);
            } else {
                // Aguardar processo terminar
                this.currentProcess.on('close', (code) => {
                    this.currentProcess = null;
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Player exited with code ${code}`));
                    }
                });
            }
            
            this.currentProcess.on('error', (error) => {
                if (error.code === 'ENOENT') {
                    // Player não encontrado, tentar alternativa
                    this.tryAlternativePlayer(url, durationSeconds)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(error);
                }
            });
        });
    }

    /**
     * Tenta player alternativo
     */
    async tryAlternativePlayer(url, durationSeconds) {
        // Tentar mpv no Linux
        if (this.platform !== 'win32') {
            return this.playWithMPV(url, durationSeconds);
        }
        
        // Tentar Windows Media Player no Windows
        if (this.platform === 'win32') {
            return this.playWithWMP(url, durationSeconds);
        }
        
        throw new Error('Nenhum player disponível');
    }

    /**
     * Reproduz com mpv (Linux)
     */
    async playWithMPV(url, durationSeconds) {
        return new Promise((resolve, reject) => {
            this.currentProcess = spawn('mpv', [
                '--fullscreen',
                '--no-terminal',
                url
            ], {
                stdio: 'ignore',
                detached: true
            });
            
            if (durationSeconds) {
                setTimeout(() => {
                    this.stop();
                    resolve();
                }, durationSeconds * 1000);
            } else {
                this.currentProcess.on('close', resolve);
                this.currentProcess.on('error', reject);
            }
        });
    }

    /**
     * Reproduz com Windows Media Player (Windows)
     */
    async playWithWMP(url, durationSeconds) {
        return new Promise((resolve, reject) => {
            // Windows Media Player via COM (requer node-windows)
            // Por enquanto, usar método simples
            const { exec } = require('child_process');
            exec(`start wmplayer "${url}"`, (error) => {
                if (error) {
                    reject(error);
                } else {
                    if (durationSeconds) {
                        setTimeout(() => {
                            this.stop();
                            resolve();
                        }, durationSeconds * 1000);
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    /**
     * Exibe imagem
     */
    async playImage(url, durationSeconds) {
        return new Promise((resolve) => {
            // Abrir imagem com visualizador padrão
            const { exec } = require('child_process');
            
            let command;
            if (this.platform === 'win32') {
                command = `start "" "${url}"`;
            } else {
                command = `xdg-open "${url}"`;
            }
            
            exec(command, () => {
                // Aguardar duração especificada
                setTimeout(() => {
                    this.stop();
                    resolve();
                }, durationSeconds * 1000);
            });
        });
    }

    /**
     * Exibe HTML/Web
     */
    async playHTML(url, durationSeconds) {
        return new Promise((resolve) => {
            // Abrir HTML no navegador padrão
            const { exec } = require('child_process');
            
            let command;
            if (this.platform === 'win32') {
                command = `start "" "${url}"`;
            } else {
                command = `xdg-open "${url}"`;
            }
            
            exec(command, () => {
                // Aguardar duração especificada
                setTimeout(() => {
                    this.stop();
                    resolve();
                }, durationSeconds * 1000);
            });
        });
    }

    /**
     * Para reprodução
     */
    stop() {
        if (this.currentProcess) {
            try {
                if (this.platform === 'win32') {
                    this.currentProcess.kill();
                } else {
                    process.kill(-this.currentProcess.pid);
                }
            } catch (e) {
                // Processo já terminou
            }
            this.currentProcess = null;
        }
        
        this.currentMediaItem = null;
        this.emit('ended');
    }

    /**
     * Pausa reprodução
     */
    pause() {
        // Implementar se necessário
        // VLC suporta pausa via controle remoto
    }

    /**
     * Resume reprodução
     */
    resume() {
        // Implementar se necessário
        // VLC suporta resume via controle remoto
    }

    /**
     * Libera recursos
     */
    release() {
        this.stop();
    }
}

module.exports = MediaPlayer;
