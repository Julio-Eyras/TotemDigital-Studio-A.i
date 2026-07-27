package br.com.smartchannel.playerad.cache

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MediaCacheManagerTest {

    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun cleanupIfNeeded_pressurePass_evictsWithoutAgeWindow() {
        val dir = tmp.newFolder("propagandas")
        // Teto mínimo efectivo do manager é 50 MB.
        val maxBytes = 50L * 1024L * 1024L
        val mgr = MediaCacheManager.forTesting(dir, maxCacheSizeBytes = maxBytes)
        mgr.init()

        File(dir, "1.bin").writeBytes(ByteArray(8))
        File(dir, "2.bin").writeBytes(ByteArray(8))
        val chunk = 40L * 1024L * 1024L
        mgr.onDownloadCompleted(1L, "1.bin", chunk, null, "application/octet-stream")
        mgr.onDownloadCompleted(2L, "2.bin", chunk, null, "application/octet-stream")
        assertEquals(chunk * 2, mgr.getCurrentCacheSizeBytes())

        mgr.cleanupIfNeeded()
        assertTrue(mgr.getCurrentCacheSizeBytes() <= maxBytes)
        assertFalse(mgr.getMetadata(1L)?.valid == true)
        assertTrue(mgr.getMetadata(2L)?.valid == true)
    }

    @Test
    fun invalidateAllEntriesKeepHistory_marksInvalid() {
        val dir = tmp.newFolder("propagandas")
        val mgr = MediaCacheManager.forTesting(dir, maxCacheSizeBytes = 10_000L)
        mgr.init()
        File(dir, "9.bin").writeBytes(ByteArray(10))
        mgr.onDownloadCompleted(9L, "9.bin", 10L, null, "application/octet-stream")
        assertTrue(mgr.getMetadata(9L)!!.valid)

        mgr.invalidateAllEntriesKeepHistory()
        assertFalse(mgr.getMetadata(9L)!!.valid)
        assertTrue(File(dir, "metadata.json").exists())
    }
}
