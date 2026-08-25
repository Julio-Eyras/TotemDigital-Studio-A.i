package br.com.smartchannel.playerad.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class KioskEscapeTest {

    @Test
    fun pickOtherHome_skipsSelfPackage() {
        val picked = KioskEscape.pickOtherHome(
            selfPackage = "br.com.smartchannel.playerad",
            candidates = listOf(
                "br.com.smartchannel.playerad" to ".ui.PlayerHomeAlias",
                "com.android.tv.launcher" to ".Main",
            ),
        )
        assertEquals("com.android.tv.launcher", picked?.first)
        assertEquals(".Main", picked?.second)
    }

    @Test
    fun pickOtherHome_emptyWhenOnlySelf() {
        val picked = KioskEscape.pickOtherHome(
            selfPackage = "br.com.smartchannel.playerad",
            candidates = listOf(
                "br.com.smartchannel.playerad" to ".ui.PlayerHomeAlias",
            ),
        )
        assertNull(picked)
    }

    @Test
    fun pickFileManagerPackage_prefersDocumentsUiThenOem() {
        val installed = setOf(
            "com.estrongs.android.pop",
            "com.softwinner.TvdFileManager",
        )
        assertEquals(
            "com.softwinner.TvdFileManager",
            KioskEscape.pickFileManagerPackage(installed),
        )
    }

    @Test
    fun pickFileManagerPackage_nullWhenNoneInstalled() {
        assertNull(KioskEscape.pickFileManagerPackage(setOf("com.android.vending")))
    }
}
