package com.smartsignage.player.server

import android.content.Context
import android.util.Log
import com.smartsignage.player.cache.MediaCacheManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.Executors
import kotlinx.coroutines.runBlocking

/**
 * LocalHttpServer - Android
 * Servidor HTTP local para totens servirem mídias às Smart TVs associadas
 * 
 * Implementa servidor HTTP simples na porta 8080 (configurável)
 */
class LocalHttpServer(
    private val context: Context,
    private val cacheManager: MediaCacheManager,
    private val port: Int = 8080
) {
    private var serverSocket: ServerSocket? = null
    private val executor = Executors.newFixedThreadPool(10)
    private var isRunning = false

    companion object {
        private const val TAG = "LocalHttpServer"
    }

    /**
     * Inicia o servidor HTTP local
     */
    fun start() {
        if (isRunning) {
            Log.warn(TAG, "Servidor já está em execução")
            return
        }

        try {
            serverSocket = ServerSocket(port)
            isRunning = true
            
            executor.execute {
                Log.i(TAG, "Servidor HTTP local iniciado na porta $port")
                
                while (isRunning) {
                    try {
                        val clientSocket = serverSocket?.accept()
                        if (clientSocket != null) {
                            executor.execute {
                                handleRequest(clientSocket)
                            }
                        }
                    } catch (e: Exception) {
                        if (isRunning) {
                            Log.e(TAG, "Erro ao aceitar conexão", e)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao iniciar servidor", e)
            isRunning = false
        }
    }

    /**
     * Para o servidor HTTP local
     */
    fun stop() {
        isRunning = false
        try {
            serverSocket?.close()
            serverSocket = null
            Log.i(TAG, "Servidor HTTP local parado")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao parar servidor", e)
        }
    }

    /**
     * Processa requisição HTTP
     */
    private fun handleRequest(clientSocket: Socket) {
        try {
            val input = clientSocket.getInputStream()
            val output = clientSocket.getOutputStream()
            
            // Ler requisição HTTP
            val request = readHttpRequest(input)
            val (method, path) = parseRequest(request)
            
            Log.d(TAG, "Requisição: $method $path")
            
            when {
                path.startsWith("/media/") -> {
                    serveMedia(path, output)
                }
                path == "/health" -> {
                    serveHealth(output)
                }
                else -> {
                    serve404(output)
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao processar requisição", e)
            try {
                clientSocket.getOutputStream().write("HTTP/1.1 500 Internal Server Error\r\n\r\n".toByteArray())
            } catch (e2: Exception) {
                // Ignorar
            }
        } finally {
            try {
                clientSocket.close()
            } catch (e: Exception) {
                // Ignorar
            }
        }
    }

    /**
     * Serve arquivo de mídia do cache
     */
    private fun serveMedia(path: String, output: java.io.OutputStream) {
        try {
            // Extrair mediaId do path (ex: /media/123_abc123.mp4)
            val fileName = path.removePrefix("/media/")
            val mediaId = fileName.split("_").firstOrNull()?.toIntOrNull()
            
            if (mediaId == null) {
                serve404(output)
                return
            }
            
            // Obter caminho local do cache
            val localPath = cacheManager.getLocalPath(mediaId)
            if (localPath == null) {
                serve404(output)
                return
            }
            
            val file = File(localPath)
            if (!file.exists()) {
                serve404(output)
                return
            }
            
            // Determinar MIME type
            val mimeType = getMimeType(file.extension)
            
            // Enviar resposta HTTP
            val headers = """
                HTTP/1.1 200 OK
                Content-Type: $mimeType
                Content-Length: ${file.length()}
                Accept-Ranges: bytes
                Cache-Control: public, max-age=31536000
                
            """.trimIndent()
            
            output.write(headers.toByteArray())
            
            // Enviar arquivo
            FileInputStream(file).use { input ->
                input.copyTo(output)
            }
            
            Log.d(TAG, "Mídia servida: $localPath")
            
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao servir mídia", e)
            serve500(output)
        }
    }

    /**
     * Serve endpoint de health check
     */
    private fun serveHealth(output: java.io.OutputStream) {
        // Obter informações do totem (UIN, etc.)
        val totemUIN = getTotemUIN() // Implementar método para obter UIN
        
        val response = """
            HTTP/1.1 200 OK
            Content-Type: application/json
            Access-Control-Allow-Origin: *
            
            {"status":"ok","totemUIN":"$totemUIN","version":"2.1.0","timestamp":${System.currentTimeMillis()},"cacheSize":${getCacheSize()}}
        """.trimIndent()
        output.write(response.toByteArray())
    }
    
    /**
     * Obtém UIN do totem (implementar conforme necessário)
     */
    private fun getTotemUIN(): String {
        // TODO: Obter UIN do SharedPreferences ou configuração
        return "TOTEM_001" // Placeholder
    }
    
    /**
     * Obtém tamanho do cache
     */
    private fun getCacheSize(): Long {
        return cacheManager.getCacheSize()
    }

    /**
     * Serve erro 404
     */
    private fun serve404(output: java.io.OutputStream) {
        val response = """
            HTTP/1.1 404 Not Found
            Content-Type: application/json
            
            {"error":"Not Found"}
        """.trimIndent()
        output.write(response.toByteArray())
    }

    /**
     * Serve erro 500
     */
    private fun serve500(output: java.io.OutputStream) {
        val response = """
            HTTP/1.1 500 Internal Server Error
            Content-Type: application/json
            
            {"error":"Internal Server Error"}
        """.trimIndent()
        output.write(response.toByteArray())
    }

    /**
     * Lê requisição HTTP do input stream
     */
    private fun readHttpRequest(input: java.io.InputStream): String {
        val buffer = StringBuilder()
        val byteBuffer = ByteArray(8192)
        
        var bytesRead = input.read(byteBuffer)
        while (bytesRead > 0) {
            buffer.append(String(byteBuffer, 0, bytesRead))
            
            // Verificar se requisição completa (termina com \r\n\r\n)
            if (buffer.contains("\r\n\r\n")) {
                break
            }
            
            bytesRead = input.read(byteBuffer)
        }
        
        return buffer.toString()
    }

    /**
     * Parse requisição HTTP
     */
    private fun parseRequest(request: String): Pair<String, String> {
        val lines = request.lines()
        if (lines.isEmpty()) {
            return Pair("GET", "/")
        }
        
        val firstLine = lines[0]
        val parts = firstLine.split(" ")
        val method = parts.getOrNull(0) ?: "GET"
        val path = parts.getOrNull(1) ?: "/"
        
        return Pair(method, path)
    }

    /**
     * Obtém MIME type pela extensão
     */
    private fun getMimeType(extension: String): String {
        return when (extension.lowercase()) {
            "mp4" -> "video/mp4"
            "webm" -> "video/webm"
            "mov" -> "video/quicktime"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "mp3" -> "audio/mpeg"
            "ogg" -> "audio/ogg"
            "wav" -> "audio/wav"
            else -> "application/octet-stream"
        }
    }

    /**
     * Obtém URL base do servidor
     */
    fun getBaseUrl(): String {
        // Tentar detectar IP local
        try {
            val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                val addresses = networkInterface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val address = addresses.nextElement()
                    if (!address.isLoopbackAddress && address is java.net.Inet4Address) {
                        return "http://${address.hostAddress}:$port"
                    }
                }
            }
        } catch (e: Exception) {
            Log.warn(TAG, "Erro ao detectar IP local", e)
        }
        
        return "http://localhost:$port"
    }

    /**
     * Verifica se servidor está rodando
     */
    fun isServerRunning(): Boolean {
        return isRunning
    }
}
