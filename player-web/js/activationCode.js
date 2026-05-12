/**
 * Código de ativação / UIN — alinhado ao Player-AD (PlayerConfigLoader.normalizeActivationCode).
 * Expõe `window.normalizeTotemUin` para index.html e app.js.
 */
(function (global) {
    'use strict';

    function normalizeTotemUin(raw) {
        var normalized = String(raw == null ? '' : raw)
            .trim()
            .toUpperCase()
            .replace(/\u2013/g, '-')
            .replace(/\u2014/g, '-')
            .replace(/[–—]/g, '-')
            .replace(/\s+/g, '');
        var compact = normalized.replace(/-/g, '');
        if (/^TD[A-Z0-9]{8}$/.test(compact)) {
            return 'TD-' + compact.slice(2, 6) + '-' + compact.slice(6, 10);
        }
        return normalized;
    }

    global.normalizeTotemUin = normalizeTotemUin;
})(typeof window !== 'undefined' ? window : this);
