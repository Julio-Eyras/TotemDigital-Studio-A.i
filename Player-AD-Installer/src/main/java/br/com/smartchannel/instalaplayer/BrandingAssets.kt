package br.com.smartchannel.instalaplayer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

object BrandingAssets {
    private const val TEXT = "TotemDigital"
    private const val ACCENT = 0xFFFFC107.toInt()

    fun writeBootlogoBmp(out: File) {
        out.parentFile?.mkdirs()
        writeBmp24(drawBrand(1280, 720, rotateText = false), out)
    }

    fun writeBootanimationZip(out: File, portrait: Boolean) {
        out.parentFile?.mkdirs()
        val w = if (portrait) 1080 else 1920
        val h = if (portrait) 1920 else 1080
        val png = File(out.parentFile, "boot-frame.png")
        FileOutputStream(png).use { fos ->
            drawBrand(w, h, rotateText = portrait).compress(Bitmap.CompressFormat.PNG, 100, fos)
        }
        val desc = "$w $h 1\np 1 0 part0\n".toByteArray(Charsets.US_ASCII)
        ZipOutputStream(BufferedOutputStream(FileOutputStream(out))).use { zos ->
            zos.setMethod(ZipOutputStream.STORED)
            putStored(zos, "desc.txt", desc)
            putStored(zos, "part0/00000.png", png.readBytes())
        }
        png.delete()
    }

    private fun drawBrand(width: Int, height: Int, rotateText: Boolean): Bitmap {
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        canvas.drawColor(Color.BLACK)
        val fontSize = (minOf(width, height) * 0.09f).coerceAtLeast(48f)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = fontSize
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = ACCENT
            strokeWidth = (fontSize / 12f).coerceAtLeast(4f)
        }
        canvas.save()
        if (rotateText) {
            canvas.rotate(270f, width / 2f, height / 2f)
        }
        val cx = width / 2f
        val cy = height / 2f
        canvas.drawText(TEXT, cx, cy, paint)
        val tw = paint.measureText(TEXT)
        val ly = cy + fontSize * 0.35f
        canvas.drawLine(cx - tw * 0.42f, ly, cx + tw * 0.42f, ly, line)
        canvas.restore()
        return bmp
    }

    private fun writeBmp24(bitmap: Bitmap, out: File) {
        val w = bitmap.width
        val h = bitmap.height
        val rowStride = ((w * 3 + 3) / 4) * 4
        val pixelSize = rowStride * h
        val header = ByteBuffer.allocate(54).order(ByteOrder.LITTLE_ENDIAN)
        header.put('B'.code.toByte())
        header.put('M'.code.toByte())
        header.putInt(54 + pixelSize)
        header.putInt(0)
        header.putInt(54)
        header.putInt(40)
        header.putInt(w)
        header.putInt(h)
        header.putShort(1)
        header.putShort(24)
        header.putInt(0)
        header.putInt(pixelSize)
        header.putInt(2835)
        header.putInt(2835)
        header.putInt(0)
        header.putInt(0)
        FileOutputStream(out).use { fos ->
            fos.write(header.array())
            val row = ByteArray(rowStride)
            val pixels = IntArray(w)
            for (y in h - 1 downTo 0) {
                bitmap.getPixels(pixels, 0, w, 0, y, w, 1)
                var i = 0
                for (c in pixels) {
                    row[i++] = (c and 0xFF).toByte()
                    row[i++] = (c shr 8 and 0xFF).toByte()
                    row[i++] = (c shr 16 and 0xFF).toByte()
                }
                fos.write(row)
            }
        }
        bitmap.recycle()
    }

    private fun putStored(zos: ZipOutputStream, name: String, data: ByteArray) {
        val crc = CRC32().apply { update(data) }
        val entry = ZipEntry(name).apply {
            method = ZipEntry.STORED
            size = data.size.toLong()
            compressedSize = data.size.toLong()
            this.crc = crc.value
        }
        zos.putNextEntry(entry)
        zos.write(data)
        zos.closeEntry()
    }
}
