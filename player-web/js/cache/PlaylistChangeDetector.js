/**
 * PlaylistChangeDetector - Browser
 * Detecta mudanças em DispatchPlans comparando playlistId, mídias e metadados
 * Similar ao comportamento das plataformas WebOS, Tizen e Android
 */

class PlaylistChangeDetector {
    constructor() {
        this.lastPlan = null;
    }

    /**
     * Verifica se o DispatchPlan mudou em relação ao último recebido
     * @param {Object} oldPlan - Plano anterior (pode ser null)
     * @param {Object} newPlan - Novo plano recebido
     * @returns {boolean} true se houve mudança significativa
     */
    hasPlanChanged(oldPlan, newPlan) {
        // Se não há plano anterior, considera como mudança
        if (!oldPlan) {
            return true;
        }

        // Se não há novo plano, não há mudança
        if (!newPlan) {
            return false;
        }

        // Comparar playlistId
        if (oldPlan.playlistId !== newPlan.playlistId) {
            console.log('[PlaylistChangeDetector] Mudança detectada: playlistId diferente');
            return true;
        }

        // Comparar quantidade de mídias
        const oldCount = oldPlan.mediaItems?.length || 0;
        const newCount = newPlan.mediaItems?.length || 0;
        if (oldCount !== newCount) {
            console.log('[PlaylistChangeDetector] Mudança detectada: quantidade de mídias diferente');
            return true;
        }

        // Comparar IDs e ordem das mídias
        const oldMediaIds = (oldPlan.mediaItems || []).map(item => item.mediaId).join(',');
        const newMediaIds = (newPlan.mediaItems || []).map(item => item.mediaId).join(',');
        if (oldMediaIds !== newMediaIds) {
            console.log('[PlaylistChangeDetector] Mudança detectada: ordem ou IDs de mídias diferentes');
            return true;
        }

        // Comparar validade (validityStart/validityEnd)
        const oldValidityStart = oldPlan.validityStart ? new Date(oldPlan.validityStart).getTime() : null;
        const newValidityStart = newPlan.validityStart ? new Date(newPlan.validityStart).getTime() : null;
        const oldValidityEnd = oldPlan.validityEnd ? new Date(oldPlan.validityEnd).getTime() : null;
        const newValidityEnd = newPlan.validityEnd ? new Date(newPlan.validityEnd).getTime() : null;

        if (oldValidityStart !== newValidityStart || oldValidityEnd !== newValidityEnd) {
            console.log('[PlaylistChangeDetector] Mudança detectada: período de validade diferente');
            return true;
        }

        // Comparar checksums das mídias (se disponíveis)
        for (let i = 0; i < Math.min(oldCount, newCount); i++) {
            const oldItem = oldPlan.mediaItems[i];
            const newItem = newPlan.mediaItems[i];
            
            const oldChecksum = oldItem.metadata?.checksum;
            const newChecksum = newItem.metadata?.checksum;
            
            if (oldChecksum && newChecksum && oldChecksum !== newChecksum) {
                console.log(`[PlaylistChangeDetector] Mudança detectada: checksum da mídia ${oldItem.mediaId} diferente`);
                return true;
            }
        }

        // Comparar metadados da playlist (se disponíveis)
        const oldMetadata = oldPlan.metadata || {};
        const newMetadata = newPlan.metadata || {};
        
        // Comparar campaignId
        if (oldMetadata.campaignId !== newMetadata.campaignId) {
            console.log('[PlaylistChangeDetector] Mudança detectada: campaignId diferente');
            return true;
        }

        // Comparar versão/timestamp se disponível
        if (oldPlan.version && newPlan.version && oldPlan.version !== newPlan.version) {
            console.log('[PlaylistChangeDetector] Mudança detectada: versão diferente');
            return true;
        }

        // Se chegou aqui, não houve mudança significativa
        return false;
    }

    /**
     * Verifica se o plano atual expirou (validityEnd passou)
     * @param {Object} plan - Plano a verificar
     * @returns {boolean} true se expirado
     */
    isPlanExpired(plan) {
        if (!plan || !plan.validityEnd) {
            return false;
        }

        const validityEnd = new Date(plan.validityEnd).getTime();
        const now = Date.now();

        return now > validityEnd;
    }

    /**
     * Verifica se o plano ainda não é válido (validityStart no futuro)
     * @param {Object} plan - Plano a verificar
     * @returns {boolean} true se ainda não é válido
     */
    isPlanNotYetValid(plan) {
        if (!plan || !plan.validityStart) {
            return false;
        }

        const validityStart = new Date(plan.validityStart).getTime();
        const now = Date.now();

        return now < validityStart;
    }

    /**
     * Atualiza o último plano conhecido
     * @param {Object} plan - Plano a armazenar
     */
    setLastPlan(plan) {
        this.lastPlan = plan ? JSON.parse(JSON.stringify(plan)) : null;
    }

    /**
     * Obtém o último plano conhecido
     * @returns {Object|null} Último plano ou null
     */
    getLastPlan() {
        return this.lastPlan;
    }

    /**
     * Verifica se precisa atualizar baseado em intervalo de tempo
     * @param {Object} plan - Plano atual
     * @param {number} lastUpdate - Timestamp da última atualização
     * @param {number} updateInterval - Intervalo em ms (padrão: 15 minutos)
     * @returns {boolean} true se precisa atualizar
     */
    needsUpdateByInterval(plan, lastUpdate, updateInterval = 900000) {
        if (!lastUpdate) {
            return true;
        }

        const now = Date.now();
        const timeSinceUpdate = now - lastUpdate;

        return timeSinceUpdate >= updateInterval;
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistChangeDetector;
} else {
    window.PlaylistChangeDetector = PlaylistChangeDetector;
}
