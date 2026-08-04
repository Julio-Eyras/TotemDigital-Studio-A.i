package br.com.smartchannel.playerad.config

import br.com.smartchannel.playerad.cache.MediaCacheManager
import org.junit.Assert.assertEquals
import org.junit.Test

class PlayerConfigStorageParseTest {

    @Test
    fun parseStorageMode_aliasesAndDefaults() {
        assertEquals(PlayerStorageMode.EXTERNAL_PRIMARY, PlayerConfigLoader.parseStorageMode(null))
        assertEquals(PlayerStorageMode.EXTERNAL_PRIMARY, PlayerConfigLoader.parseStorageMode(""))
        assertEquals(PlayerStorageMode.EXTERNAL_PRIMARY, PlayerConfigLoader.parseStorageMode("desconhecido"))
        assertEquals(PlayerStorageMode.AUTO, PlayerConfigLoader.parseStorageMode("auto"))
        assertEquals(PlayerStorageMode.INTERNAL, PlayerConfigLoader.parseStorageMode("internal"))
        assertEquals(PlayerStorageMode.EXTERNAL_PRIMARY, PlayerConfigLoader.parseStorageMode("external"))
        assertEquals(PlayerStorageMode.EXTERNAL_PRIMARY, PlayerConfigLoader.parseStorageMode("external_primary"))
        assertEquals(PlayerStorageMode.SD_CARD, PlayerConfigLoader.parseStorageMode("sdcard"))
        assertEquals(PlayerStorageMode.SD_CARD, PlayerConfigLoader.parseStorageMode("microsd"))
        assertEquals(PlayerStorageMode.REMOVABLE_PREFERRED, PlayerConfigLoader.parseStorageMode("usb"))
        assertEquals(PlayerStorageMode.PATH_OVERRIDE, PlayerConfigLoader.parseStorageMode("path_override"))
    }

    @Test
    fun storageModeToJsonValue_stable() {
        assertEquals("sdcard", PlayerConfigLoader.storageModeToJsonValue(PlayerStorageMode.SD_CARD))
        assertEquals("external_primary", PlayerConfigLoader.storageModeToJsonValue(PlayerStorageMode.EXTERNAL_PRIMARY))
        assertEquals("auto", PlayerConfigLoader.storageModeToJsonValue(PlayerStorageMode.AUTO))
    }

    @Test
    fun coerceMediaTransitionEnabled_zeroOffElseOn() {
        assertEquals(0, PlayerConfigLoader.coerceMediaTransitionEnabled(0))
        assertEquals(1, PlayerConfigLoader.coerceMediaTransitionEnabled(1))
        assertEquals(1, PlayerConfigLoader.coerceMediaTransitionEnabled(2))
        assertEquals(1, PlayerConfigLoader.coerceMediaTransitionEnabled(-1))
    }

    @Test
    fun parseMediaTransitionEnabled_intAndBoolean() {
        assertEquals(1, PlayerConfigLoader.parseMediaTransitionEnabled(org.json.JSONObject(), 1))
        assertEquals(
            0,
            PlayerConfigLoader.parseMediaTransitionEnabled(
                org.json.JSONObject().put("mediaTransitionEnabled", 0),
                1,
            ),
        )
        assertEquals(
            1,
            PlayerConfigLoader.parseMediaTransitionEnabled(
                org.json.JSONObject().put("mediaTransitionEnabled", true),
                0,
            ),
        )
        assertEquals(
            0,
            PlayerConfigLoader.parseMediaTransitionEnabled(
                org.json.JSONObject().put("mediaTransitionEnabled", false),
                1,
            ),
        )
        assertEquals(
            0,
            PlayerConfigLoader.parseMediaTransitionEnabled(
                org.json.JSONObject().put("mediaTransitionEnabled", "off"),
                1,
            ),
        )
    }

    @Test
    fun coerceMaxCacheSizeMb_clamps() {
        assertEquals(50, PlayerConfigLoader.coerceMaxCacheSizeMb(1))
        assertEquals(8192, PlayerConfigLoader.coerceMaxCacheSizeMb(99999))
        assertEquals(1000, PlayerConfigLoader.coerceMaxCacheSizeMb(1000))
    }

    @Test
    fun effectiveMaxCacheBytes_minOfMbAndPercent() {
        val tenGb = 10L * 1024L * 1024L * 1024L
        val onlyMb = MediaCacheManager.effectiveMaxCacheBytes(1000, null, tenGb)
        assertEquals(1000L * 1024L * 1024L, onlyMb)

        val withPct = MediaCacheManager.effectiveMaxCacheBytes(1000, 10, tenGb)
        // 10% of 10GB = 1GB, min with 1000MB = 1000MB
        assertEquals(1000L * 1024L * 1024L, withPct)

        val tightPct = MediaCacheManager.effectiveMaxCacheBytes(2000, 5, tenGb)
        // 5% of 10GB = 512MB
        assertEquals(512L * 1024L * 1024L, tightPct)
    }
}
