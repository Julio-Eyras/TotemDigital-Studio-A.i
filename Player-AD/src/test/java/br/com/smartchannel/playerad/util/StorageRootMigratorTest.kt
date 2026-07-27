package br.com.smartchannel.playerad.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class StorageRootMigratorTest {

    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun migrateIfNeeded_copiesMissingFilesAndDirs() {
        val from = tmp.newFolder("from")
        val to = tmp.newFolder("to")
        File(from, "propagandas").mkdirs()
        File(from, "propagandas/1.mp4").writeText("video")
        File(from, "vinhetas").mkdirs()
        File(from, "vinhetas/v.mp4").writeText("v")
        File(from, "last-dispatch-plan.json").writeText("{}")
        File(from, "current-plan-source.txt").writeText("ONLINE")

        File(to, "propagandas").mkdirs()
        File(to, "propagandas/1.mp4").writeText("keep")

        val result = StorageRootMigrator.migrateIfNeeded(from, to)
        assertTrue(result.migrated)
        assertTrue(result.filesCopied >= 3)
        assertEquals("keep", File(to, "propagandas/1.mp4").readText())
        assertTrue(File(to, "vinhetas/v.mp4").exists())
        assertTrue(File(to, "last-dispatch-plan.json").exists())
        assertTrue(File(to, "current-plan-source.txt").exists())
    }

    @Test
    fun migrateIfNeeded_sameRoot_noop() {
        val root = tmp.newFolder("same")
        val result = StorageRootMigrator.migrateIfNeeded(root, root)
        assertFalse(result.migrated)
        assertEquals(0, result.filesCopied)
    }

    @Test
    fun probeWritableDirectory_okOnTemp() {
        val dir = tmp.newFolder("writable")
        assertTrue(StorageRootResolver.probeWritableDirectory(dir))
        assertFalse(File(dir, ".playerad_write_probe").exists())
    }
}
