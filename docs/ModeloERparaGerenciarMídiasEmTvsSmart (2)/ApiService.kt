package com.smartotem.player.api

import com.smartotem.player.models.Schedule
import com.smartotem.player.models.StatusUpdate
import com.smartotem.player.models.TotemConfig
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {

    @GET("api/v1/totem/{totemId}/config")
    suspend fun getTotemConfig(
        @Path("totemId") totemId: String,
        @Header("Authorization") authToken: String
    ): Response<TotemConfig>

    @GET("api/v1/totem/{totemId}/schedule")
    suspend fun getSchedule(
        @Path("totemId") totemId: String,
        @Header("Authorization") authToken: String
    ): Response<Schedule>

    @POST("api/v1/totem/{totemId}/status")
    suspend fun sendStatusUpdate(
        @Path("totemId") totemId: String,
        @Header("Authorization") authToken: String,
        @Body status: StatusUpdate
    ): Response<Void>

    // Em um cenário real, haveria um endpoint para download de mídia, talvez com @Streaming
    // @GET("api/v1/media/{mediaId}/download")
    // suspend fun downloadMedia(@Path("mediaId") mediaId: Int): Response<ResponseBody>
}
