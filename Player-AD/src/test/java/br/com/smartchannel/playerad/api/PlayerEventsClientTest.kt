package br.com.smartchannel.playerad.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
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
    fun `ack da rota sync e interpretado dentro de eventAck`() {
        val ack = PlayerEventsClient.parseAck(
            """
            {
              "schemaVersion": 1,
              "syncId": "sync-1",
              "eventAck": {
                "accepted": [{"eventId":"sync-ok"}],
                "duplicates": ["sync-duplicate"],
                "rejected": [{"eventId":"sync-rejected"}],
                "highestSequence": 4
              }
            }
            """.trimIndent(),
        )

        assertTrue(ack.shouldRemove(event("sync-ok", 20)))
        assertTrue(ack.shouldRemove(event("sync-duplicate", 21)))
        assertTrue(ack.shouldRemove(event("sync-rejected", 22)))
        assertTrue(ack.shouldRemove(event("sync-sequence", 4)))
        assertFalse(ack.shouldRemove(event("sync-pending", 5)))
    }

    @Test
    fun `ack da rota sync aninhado em data e interpretado`() {
        val ack = PlayerEventsClient.parseAck(
            """{"data":{"eventAck":{"accepted":["nested-sync-ok"]}}}""",
        )

        assertTrue(ack.shouldRemove(event("nested-sync-ok", 10)))
        assertFalse(ack.shouldRemove(event("pending", 10)))
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
    fun `sync de eventos entrega comandos pendentes`() {
        val commands = PlayerEventsClient.parsePendingCommands(
            """
            {
              "eventAck": {"accepted":[]},
              "pendingCommands": [
                {"id": 41, "type": "display_force_off", "data": {"source":"remote"}},
                {"request_id": "42", "command_type": "sync_now", "command_data": {}}
              ]
            }
            """.trimIndent(),
        )

        assertEquals(2, commands.size)
        assertEquals("41", commands[0].id)
        assertEquals("display_force_off", commands[0].type)
        assertEquals("remote", commands[0].data?.optString("source"))
        assertEquals("42", commands[1].id)
        assertEquals("sync_now", commands[1].type)
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
