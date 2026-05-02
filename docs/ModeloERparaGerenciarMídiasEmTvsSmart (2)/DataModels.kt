package com.smartotem.player.models

data class Media(
    val id_midia: Int,
    val nome: String,
    val url_arquivo: String,
    val tipo_midia_id: Int,
    val duracao_segundos: Int,
    val resolucao_largura: Int,
    val resolucao_altura: Int
)

data class PlaylistMedia(
    val id_playlist: Int,
    val id_midia: Int,
    val ordem_exibicao: Int,
    val duracao_exibicao_override: Int?,
    val media: Media // Embedded Media object
)

data class Playlist(
    val id_playlist: Int,
    val nome: String,
    val descricao: String,
    val duracao_total_segundos: Int,
    val midias: List<PlaylistMedia>
)

data class Schedule(
    val id_agendamento: Int,
    val nome: String,
    val data_inicio: String,
    val data_fim: String?,
    val hora_inicio: String,
    val hora_fim: String,
    val frequencia: String,
    val dias_semana: String?,
    val prioridade: Int,
    val playlist: Playlist
)

data class TotemConfig(
    val id_totem: Int,
    val nome: String,
    val localizacao: String,
    val orientacao_tela: String,
    val resolucao_largura: Int,
    val resolucao_altura: Int
)

data class StatusUpdate(
    val type: String,
    val message: String,
    val media_id: Int? = null,
    val error: String? = null,
    val timestamp: String? = null
)

data class WebSocketCommand(
    val command: String,
    val playlist_id: Int? = null,
    val message: String? = null,
    val media_id: Int? = null,
    val totem_id: String? = null,
    val action: String? = null
)
