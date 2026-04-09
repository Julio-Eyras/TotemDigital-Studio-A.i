package br.com.smartchannel.smartsignagead.util

import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.storage.StorageManager
import android.os.storage.StorageVolume
import java.io.File
import java.util.ArrayDeque

object AppDirs {
    fun root(context: Context): File = context.getExternalFilesDir(null) ?: context.filesDir

    /**
     * Demo interno do app (somente assets embutidos).
     */
    fun demoRoot(context: Context): File =
        File(context.filesDir, "demo-media").apply { if (!exists()) mkdirs() }

    fun demoPropagandas(context: Context): File =
        File(demoRoot(context), "propagandas").apply { if (!exists()) mkdirs() }

    fun demoVinhetas(context: Context): File =
        File(demoRoot(context), "vinhetas").apply { if (!exists()) mkdirs() }

    /**
     * Raízes de volumes (USB/SD, armazenamento partilhado, etc.) para montar pastas de mídia.
     * Usa [StorageManager] e [getExternalFilesDirs] porque em Android 10+ listar só `/storage`
     * costuma falhar (listFiles null / SELinux).
     */
    private fun volumeRootPaths(context: Context): LinkedHashSet<String> {
        val paths = linkedSetOf<String>()

        val sm = context.getSystemService(Context.STORAGE_SERVICE) as? StorageManager
        if (sm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                for (vol in sm.storageVolumes) {
                    val p = storageVolumeRootPath(vol)
                    if (!p.isNullOrBlank()) paths.add(p)
                }
            } catch (_: Exception) {
            }
        }

        for (dir in context.getExternalFilesDirs(null)) {
            if (dir == null) continue
            extractStorageVolumeRoot(dir.absolutePath)?.let { paths.add(it) }
        }
        context.getExternalFilesDir(null)?.absolutePath?.let { extractStorageVolumeRoot(it) }?.let { paths.add(it) }

        try {
            Environment.getExternalStorageDirectory()?.absolutePath?.let { paths.add(it) }
        } catch (_: Exception) {
        }

        paths.addAll(legacyScanVolumeRoots())
        return paths
    }

    /** Exposto para diagnostico (ecra debug / log). */
    fun mediaVolumeRoots(context: Context): List<String> = volumeRootPaths(context).toList()

    private fun storageVolumeRootPath(vol: StorageVolume): String? {
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> vol.directory?.absolutePath
            else -> {
                try {
                    val m = vol.javaClass.getMethod("getPath")
                    (m.invoke(vol) as? String)?.trim()?.takeIf { it.isNotEmpty() }
                } catch (_: Exception) {
                    null
                }
            }
        }
    }

    /**
     * Ex.: `/storage/767A-CDC1/Android/data/...` -> `/storage/767A-CDC1`
     */
    private fun extractStorageVolumeRoot(absolutePath: String): String? {
        val m = Regex("^(/storage/[^/]+)").find(absolutePath) ?: return null
        return m.groupValues[1]
    }

    /** Varredura antiga (TV boxes): filhos diretos de /storage, /mnt/media_rw, etc. */
    private fun legacyScanVolumeRoots(): Set<String> {
        val roots = linkedSetOf<String>()
        val bases = listOf(
            "/storage",
            "/mnt/media_rw",
            "/mnt/usb_storage",
            "/mnt/usb",
            "/storage/usbotg"
        )
        for (base in bases) {
            val baseDir = File(base)
            if (!baseDir.exists() || !baseDir.isDirectory) continue
            val children = baseDir.listFiles() ?: continue
            for (child in children) {
                if (child.isDirectory) roots.add(child.absolutePath)
            }
        }
        return roots
    }

    /**
     * BFS a partir da raiz do volume: encontra subpastas com nome [folderName] (case-insensitive).
     * Profundidade limitada ([maxDepth] niveis) para nao varrer arvores enormes; [maxDirsVisited] corta o scan.
     */
    private fun discoverSubdirsNamed(
        volumeRoot: File,
        folderName: String,
        maxDepth: Int,
        maxDirsVisited: Int
    ): List<File> {
        val target = folderName.lowercase()
        val found = mutableListOf<File>()
        val queue = ArrayDeque<Pair<File, Int>>()
        queue.add(volumeRoot to 0)
        val visited = HashSet<String>()
        var visits = 0

        while (queue.isNotEmpty() && visits < maxDirsVisited) {
            val (dir, depth) = queue.removeFirst()
            val path = dir.absolutePath
            if (path in visited) continue
            if (!dir.isDirectory) continue
            visited.add(path)
            visits++

            val children = dir.listFiles() ?: continue
            for (child in children) {
                if (!child.isDirectory) continue
                if (shouldSkipDirForScan(child)) continue
                val name = child.name.lowercase()
                if (name == target) {
                    found.add(child)
                    continue
                }
                if (depth >= maxDepth) continue
                if (shouldSkipSubtreeEnter(child)) continue
                queue.add(child to depth + 1)
            }
        }
        return found
    }

    private fun shouldSkipDirForScan(dir: File): Boolean {
        val n = dir.name
        if (n.startsWith(".") && n.length > 1) return true
        if (n.equals("LOST.DIR", true)) return true
        if (n.equals("System Volume Information", true)) return true
        if (n.equals("\$RECYCLE.BIN", true)) return true
        return false
    }

    /** Evita entrar em ramos lentos ou sem utilidade para mídia de totem. */
    private fun shouldSkipSubtreeEnter(dir: File): Boolean {
        val n = dir.name
        val parent = dir.parentFile
        if (n.equals("obb", true) && parent?.name?.equals("Android", true) == true) return true
        if (n.equals(".thumbnails", true)) return true
        return false
    }

    /**
     * Apenas caminhos fixos por volume (sem BFS). Usado para escolher pasta de **cache** do dispatch:
     * a BFS com [folderName] = "cache" encontrava pastas do sistema (ex. Android/.../cache) e quebrava gravação.
     */
    private fun externalMediaDirsFixedOnly(context: Context, folderName: String): List<File> {
        val out = mutableListOf<File>()
        for (rootPath in volumeRootPaths(context)) {
            val root = File(rootPath)
            if (!root.exists() || !root.isDirectory) continue
            out += File(root, "smartsignage-ad/$folderName")
            out += File(root, folderName)
        }
        return out.distinctBy { it.absolutePath }
    }

    /**
     * Diretórios efetivos: SD/USB/memória partilhada.
     *
     * 1) Caminhos fixos: `<volume>/propagandas`, `<volume>/smartsignage-ad/...`
     * 2) BFS: subpastas com o nome pedido (só para **mídia**; não usar para escolher `cache` do dispatch).
     */
    fun externalMediaDirs(context: Context, folderName: String): List<File> {
        val seen = LinkedHashSet<String>()
        val out = mutableListOf<File>()
        fun add(dir: File) {
            val a = dir.absolutePath
            if (seen.add(a)) out.add(dir)
        }

        val roots = volumeRootPaths(context)
        for (rootPath in roots) {
            val root = File(rootPath)
            if (!root.exists() || !root.isDirectory) continue
            add(File(root, "smartsignage-ad/$folderName"))
            add(File(root, folderName))
            try {
                val extra = discoverSubdirsNamed(
                    volumeRoot = root,
                    folderName = folderName,
                    maxDepth = 4,
                    maxDirsVisited = 3000
                )
                for (f in extra) add(f)
            } catch (e: Exception) {
                SmartSignageAdLogger.w(
                    "MEDIA_SCAN",
                    "BFS falhou em ${root.absolutePath} ($folderName): ${e.message}"
                )
            }
        }

        SmartSignageAdLogger.i(
            "MEDIA_SCAN",
            "externalMediaDirs('$folderName'): ${out.size} pastas em ${roots.size} volume(s)"
        )
        return out
    }

    /**
     * Diretório externo preferencial para gravação (ex.: cache do dispatch). **Só caminhos fixos** por volume.
     */
    fun preferredExternalWritableDir(context: Context, folderName: String): File? {
        return externalMediaDirsFixedOnly(context, folderName)
            .firstOrNull { dir ->
                try {
                    if (!dir.exists()) dir.mkdirs()
                    dir.exists() && dir.isDirectory && dir.canWrite()
                } catch (_: Exception) {
                    false
                }
            }
    }

    fun rootUsagePercent(context: Context): Double {
        val root = root(context)
        val total = root.totalSpace
        if (total <= 0L) return 0.0
        val used = total - root.usableSpace
        return (used.toDouble() / total.toDouble()) * 100.0
    }
}
