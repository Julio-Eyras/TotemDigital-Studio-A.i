package br.com.smartchannel.playerad.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdaptivePollSchedulerTest {
    @Test
    fun `informa tempo restante sem acordar antes do heartbeat`() {
        val scheduler = AdaptivePollScheduler(
            name = "heartbeat",
            activeBaseIntervalMs = 30_000L,
            maxIntervalMs = 600_000L,
        )

        scheduler.markAttempted(10_000L)

        assertEquals(20_000L, scheduler.millisUntilDue(20_000L))
        assertFalse(scheduler.due(39_999L))
        assertEquals(0L, scheduler.millisUntilDue(40_000L))
        assertTrue(scheduler.due(40_000L))
    }
}
