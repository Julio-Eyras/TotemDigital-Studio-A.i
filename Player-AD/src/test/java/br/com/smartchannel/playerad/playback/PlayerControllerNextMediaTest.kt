package br.com.smartchannel.playerad.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import org.json.JSONArray
import org.json.JSONObject

class PlayerControllerNextMediaTest {
    @Test
    fun `resolve proxima midia pela ordem do plano`() {
        val first = media(id = 10, order = 2, name = "Primeira")
        val next = media(id = 20, order = 3, name = "Próxima", duration = 12)
        val earlier = media(id = 5, order = 1, name = "Anterior")

        val resolved = PlayerController.resolveNextMedia(listOf(first, next, earlier), first)

        assertEquals(20L, resolved?.id)
        assertEquals("Próxima", resolved?.name)
        assertEquals("video/mp4", resolved?.type)
        assertEquals(12_000L, resolved?.durationMs)
        assertEquals(3, resolved?.order)
    }

    @Test
    fun `ultima midia volta ciclicamente para primeira`() {
        val first = media(id = 10, order = 1, name = "Primeira")
        val last = media(id = 20, order = 2, name = "Última")

        val resolved = PlayerController.resolveNextMedia(listOf(first, last), last)

        assertEquals(10L, resolved?.id)
        assertEquals(1, resolved?.order)
    }

    @Test
    fun `plano vazio nao possui proxima midia`() {
        assertNull(PlayerController.resolveNextMedia(emptyList(), media(1, 1, "Atual")))
    }

    @Test
    fun `estado EMPTY explicito aceita somente plano vazio`() {
        val response = JSONObject().apply {
            put("data", JSONObject().apply {
                put("planState", "EMPTY")
                put("plan", JSONObject().put("mediaItems", JSONArray()))
            })
        }

        assertEquals(
            PlayerController.PLAN_STATE_EMPTY,
            PlayerController.resolvePlanState(response, mediaItemCount = 0),
        )
        assertThrows(IllegalArgumentException::class.java) {
            PlayerController.resolvePlanState(response, mediaItemCount = 1)
        }
    }

    @Test
    fun `resposta malformada sem estado nem lista nao vira EMPTY`() {
        val response = JSONObject().put(
            "data",
            JSONObject().put("plan", JSONObject()),
        )

        assertThrows(IllegalArgumentException::class.java) {
            PlayerController.resolvePlanState(response, mediaItemCount = 0)
        }
    }

    @Test
    fun `contrato legado com lista continua compativel`() {
        val response = JSONObject().put(
            "data",
            JSONObject().put(
                "plan",
                JSONObject().put("mediaItems", JSONArray().put(JSONObject().put("mediaId", 1))),
            ),
        )

        assertEquals(
            PlayerController.PLAN_STATE_ACTIVE,
            PlayerController.resolvePlanState(response, mediaItemCount = 1),
        )
    }

    private fun media(
        id: Long,
        order: Int,
        name: String,
        duration: Long = 10,
    ) = PlayerController.DispatchMediaItem(
        mediaId = id,
        url = "https://example.invalid/$id",
        duration = duration,
        mediaType = "video/mp4",
        order = order,
        label = name,
    )
}
