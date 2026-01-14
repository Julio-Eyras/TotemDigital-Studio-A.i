package com.smartsignage.player.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.provider.Settings
import android.util.Log

/**
 * TotemDiscoveryService - Android
 * Gerencia registro e descoberta de totem via mDNS (NSD API)
 * 
 * Permite que Smart TVs descubram totens Android automaticamente
 */
class TotemDiscoveryService(private val context: Context) {
    private val TAG = "TotemDiscoveryService"
    private val nsdManager: NsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var serviceInfo: NsdServiceInfo? = null
    private var isRegistered = false
    
    /**
     * Registra totem via mDNS (NSD)
     * 
     * @param totemUIN UIN do totem
     * @param port Porta do servidor HTTP local (padrão: 8080)
     */
    fun registerTotem(totemUIN: String, port: Int = 8080) {
        if (isRegistered) {
            Log.w(TAG, "Totem já está registrado via mDNS")
            return
        }
        
        if (totemUIN.isEmpty()) {
            Log.w(TAG, "TOTEM_UIN vazio, não é possível registrar mDNS")
            return
        }
        
        val deviceId = getDeviceId()
        val serviceName = "Publisher-$deviceId"
        
        serviceInfo = NsdServiceInfo().apply {
            this.serviceName = serviceName
            serviceType = "_smartsignage-totem._tcp"
            setPort(port)
            
            // Adicionar atributos TXT (metadados do serviço)
            setAttribute("role", "publisher")
            setAttribute("player", "android")
            setAttribute("version", "2.1.0")
            setAttribute("totemUIN", totemUIN)
        }
        
        registrationListener = object : NsdManager.RegistrationListener {
            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "Falha ao registrar serviço mDNS: $errorCode")
                isRegistered = false
                
                when (errorCode) {
                    NsdManager.FAILURE_ALREADY_ACTIVE -> {
                        Log.w(TAG, "Serviço já está registrado, tentando desregistrar primeiro...")
                        unregisterTotem()
                        // Tentar novamente após delay
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            registerTotem(totemUIN, port)
                        }, 1000)
                    }
                    NsdManager.FAILURE_INTERNAL_ERROR -> {
                        Log.e(TAG, "Erro interno do NSD")
                    }
                    NsdManager.FAILURE_MAX_LIMIT -> {
                        Log.e(TAG, "Limite máximo de serviços registrados atingido")
                    }
                }
            }
            
            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "Falha ao desregistrar serviço mDNS: $errorCode")
            }
            
            override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {
                isRegistered = true
                Log.i(TAG, "Totem registrado via mDNS com sucesso!")
                Log.i(TAG, "Nome do serviço: ${serviceInfo.serviceName}")
                Log.i(TAG, "Tipo: ${serviceInfo.serviceType}")
                Log.i(TAG, "Porta: ${serviceInfo.port}")
                Log.i(TAG, "Smart TVs podem descobrir este totem automaticamente")
            }
            
            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                isRegistered = false
                Log.i(TAG, "Totem desregistrado via mDNS")
            }
        }
        
        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)
            Log.i(TAG, "Tentando registrar serviço mDNS: $serviceName")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao registrar serviço mDNS", e)
            isRegistered = false
        }
    }
    
    /**
     * Desregistra totem
     */
    fun unregisterTotem() {
        if (!isRegistered) {
            return
        }
        
        registrationListener?.let {
            try {
                nsdManager.unregisterService(it)
                Log.i(TAG, "Desregistrando serviço mDNS...")
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao desregistrar serviço mDNS", e)
            }
        }
        registrationListener = null
        serviceInfo = null
        isRegistered = false
    }
    
    /**
     * Verifica se totem está registrado
     */
    fun isRegistered(): Boolean {
        return isRegistered
    }
    
    /**
     * Obtém device ID único do Android
     */
    private fun getDeviceId(): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "unknown-${System.currentTimeMillis()}"
    }
    
    /**
     * Obtém informações do serviço registrado
     */
    fun getServiceInfo(): NsdServiceInfo? {
        return serviceInfo
    }
}
