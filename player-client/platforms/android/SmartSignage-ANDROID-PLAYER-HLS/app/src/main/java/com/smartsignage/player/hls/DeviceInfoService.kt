package com.smartsignage.player.hls

import android.content.Context
import android.provider.Settings
import android.util.Log
import java.net.NetworkInterface
import java.security.MessageDigest
import java.security.NoSuchAlgorithmException

/**
 * DeviceInfoService - Coleta informações únicas do hardware (Android TV)
 */
class DeviceInfoService(private val context: Context) {
    private val prefs = context.getSharedPreferences("smartsignage", Context.MODE_PRIVATE)
    
    companion object {
        private const val TAG = "DeviceInfo"
        private const val KEY_UIN = "uin"
    }

    /**
     * Coleta informações do hardware
     */
    fun collectHardwareInfo(): HardwareInfo {
        val macAddress = getMacAddress()
        val deviceId = getDeviceId()
        val serialNumber = getSerialNumber()
        
        return HardwareInfo(
            macAddress = macAddress,
            deviceId = deviceId,
            serialNumber = serialNumber,
            platform = "Android TV",
            hostname = android.os.Build.MODEL,
            modelName = android.os.Build.MODEL,
            hardwareHash = generateHardwareHash(macAddress, deviceId, serialNumber)
        )
    }

    /**
     * Obtém MAC Address
     */
    private fun getMacAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                val mac = networkInterface.hardwareAddress
                if (mac != null && mac.isNotEmpty()) {
                    return mac.joinToString(":") { "%02X".format(it) }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Erro ao obter MAC Address", e)
        }
        return "unknown"
    }

    /**
     * Obtém Device ID (Android ID)
     */
    private fun getDeviceId(): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "unknown"
    }

    /**
     * Obtém Serial Number
     */
    private fun getSerialNumber(): String {
        return try {
            android.os.Build.getSerial()
        } catch (e: Exception) {
            Log.w(TAG, "Erro ao obter Serial Number", e)
            "unknown"
        }
    }

    /**
     * Gera UIN único baseado nas informações do hardware
     */
    fun generateUIN(hardwareInfo: HardwareInfo): String {
        val parts = mutableListOf<String>()
        parts.add("ANDROID")

        if (hardwareInfo.macAddress != "unknown") {
            val mac = hardwareInfo.macAddress.replace(":", "").uppercase()
            parts.add(mac)
        }

        if (hardwareInfo.deviceId != "unknown") {
            val deviceId = hardwareInfo.deviceId.take(8).uppercase()
            parts.add(deviceId)
        }

        if (parts.size <= 1) {
            parts.add(simpleHash(android.os.Build.MODEL).take(12))
        }

        return parts.joinToString("_")
    }

    /**
     * Gera hash único do hardware
     */
    private fun generateHardwareHash(mac: String, deviceId: String, serial: String): String {
        val data = listOf(mac, deviceId, serial)
            .filter { it != "unknown" }
            .joinToString(":")
        return simpleHash(data)
    }

    /**
     * Hash simples
     */
    private fun simpleHash(input: String): String {
        return try {
            val md = MessageDigest.getInstance("MD5")
            val hash = md.digest(input.toByteArray())
            hash.joinToString("") { "%02x".format(it) }
        } catch (e: NoSuchAlgorithmException) {
            Log.w(TAG, "Erro ao gerar hash", e)
            input.hashCode().toString(16)
        }
    }

    /**
     * Obtém UIN salvo
     */
    fun getUIN(): String? {
        return prefs.getString(KEY_UIN, null)
    }

    /**
     * Salva UIN
     */
    fun saveUIN(uin: String) {
        prefs.edit().putString(KEY_UIN, uin).apply()
    }
}

data class HardwareInfo(
    val macAddress: String,
    val deviceId: String,
    val serialNumber: String,
    val platform: String,
    val hostname: String,
    val modelName: String,
    val hardwareHash: String
)

