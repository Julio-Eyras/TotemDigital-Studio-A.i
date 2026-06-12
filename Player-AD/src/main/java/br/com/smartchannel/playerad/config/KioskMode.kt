package br.com.smartchannel.playerad.config

/**
 * Modo de apresentação do player na tela principal.
 *
 * - [IMMERSIVE]: fullscreen imersivo (barras ocultas); útil durante debug/manutenção.
 * - [STRONG]: imersivo + lock task + bloqueio de teclas de sistema (HOME/recents), quando o SO permitir.
 */
enum class KioskMode {
    IMMERSIVE,
    STRONG
}
