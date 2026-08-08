package br.com.smartchannel.playerad.api

import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayerEventsClientTest {
    @Test
    fun `ack parcial remove aceitos duplicados rejeitados e sequencias confirmadas`() {
        val ack = PlayerEventsClient.parseAck(
            """
            {
              "accepted": ["accepted-id"],
              "duplicates": [{"eventId":"duplicate-id"}],
              "rejected": [{"eventId":"rejected-id","reason":"invalid"}],
              "highestSequence": 7
            }
            """.trimIndent(),
        )

        assertTrue(ack.shouldRemove(event("accepted-id", 20)))
        assertTrue(ack.shouldRemove(event("duplicate-id", 21)))
        assertTrue(ack.shouldRemove(event("rejected-id", 22)))
        assertTrue(ack.shouldRemove(event("implicit-id", 7)))
        assertFalse(ack.shouldRemove(event("pending-id", 8)))
    }

    @Test
    fun `ack aninhado em data tambem e interpretado`() {
        val ack = PlayerEventsClient.parseAck(
            """{"data":{"accepted":[{"eventId":"ok"}],"highestSequence":2}}""",
        )

        assertTrue(ack.shouldRemove(event("ok", 10)))
        assertTrue(ack.shouldRemove(event("older", 1)))
        assertFalse(ack.shouldRemove(event("newer", 3)))
    }

    @Test
    fun `highestSequence nao confirma outro boot`() {
        val ack = PlayerEventsClient.parseAck("""{"highestSequence":50}""")
        val oldBoot = event("old", 30).put("bootId", "boot-old")
        val newBoot = event("new", 1).put("bootId", "boot-new")

        assertTrue(ack.shouldRemove(oldBoot, "boot-old"))
        assertFalse(ack.shouldRemove(newBoot, "boot-old"))
    }

    @Test
    fun `timestamp de evento e UTC ISO`() {
        assertTrue(
            PlayerEventsClient.isoNow(0L) == "1970-01-01T00:00:00.000Z",
        )
    }

    private fun event(id: String, sequence: Long) = JSONObject()
        .put("eventId", id)
        .put("sequence", sequence)
}
