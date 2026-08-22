package br.com.smartchannel.instalaplayer

/**
 * Sentido das imagens de boot escolhido pelo técnico no campo.
 * Alinhado às etiquetas do Player-AD (`player_screen_orientation_labels`).
 */
enum class BootOrientation(val label: String) {
    PORTRAIT("Retrato (topo para cima)"),
    REVERSE_PORTRAIT("Retrato invertido (topo para baixo)"),
    LANDSCAPE("Paisagem (horizontal)");
}
