# Análise: mDNS/SSDP/Scan - Incluindo Android

## 📋 Plataformas de Totens

### Totens Suportados
- ✅ **Linux** (SBCs, Raspberry Pi, etc.)
- ✅ **Windows** (Desktop, NUC, etc.)
- ✅ **Android** (Android TV Box, Fire TV, etc.)

---

## 🔍 Implementação por Plataforma

### 1. Linux/Windows

#### mDNS (Avahi/Bonjour)
**Status**: ⚠️ Parcial (mencionado mas não implementado)

**Implementação Sugerida:**
```bash
# Instalar Avahi
sudo apt update
sudo apt install avahi-daemon avahi-utils -y

# Criar serviço
sudo nano /etc/avahi/services/smartdisplay.service
```

**Conteúdo do serviço:**
```xml
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">Publisher-%h</name>
  <service>
    <type>_smartsignage-totem._tcp</type>
    <port>8080</port>
    <txt-record>role=publisher</txt-record>
    <txt-record>player=nodejs</txt-record>
    <txt-record>version=2.1.0</txt-record>
    <txt-record>totemUIN={UIN}</txt-record>
  </service>
</service-group>
```

**Vantagens:**
- ✅ Zero configuração
- ✅ Padrão da indústria
- ✅ Funciona em LAN

**Desvantagens:**
- ⚠️ Requer Avahi instalado
- ⚠️ Pode não funcionar em VLANs restritivas

**Recomendação**: ✅ **Implementar** (alta prioridade)

---

### 2. Android

#### mDNS (NSD - Network Service Discovery)
**Status**: ❌ Não implementado

**Implementação Sugerida:**

**1. Adicionar permissões no AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**2. Implementar NSD Service:**
```kotlin
// TotemDiscoveryService.kt
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo

class TotemDiscoveryService(private val context: Context) {
    private val nsdManager: NsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private var registrationListener: NsdManager.RegistrationListener? = null
    
    /**
     * Registra totem via mDNS (NSD)
     */
    fun registerTotem(totemUIN: String, port: Int = 8080) {
        val serviceInfo = NsdServiceInfo().apply {
            serviceName = "Publisher-${getDeviceId()}"
            serviceType = "_smartsignage-totem._tcp"
            setPort(port)
            
            // Adicionar atributos TXT
            setAttribute("role", "publisher")
            setAttribute("player", "android")
            setAttribute("version", "2.1.0")
            setAttribute("totemUIN", totemUIN)
        }
        
        registrationListener = object : NsdManager.RegistrationListener {
            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "Falha ao registrar serviço mDNS: $errorCode")
            }
            
            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "Falha ao desregistrar serviço mDNS: $errorCode")
            }
            
            override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {
                Log.i(TAG, "Totem registrado via mDNS: ${serviceInfo.serviceName}")
            }
            
            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                Log.i(TAG, "Totem desregistrado via mDNS")
            }
        }
        
        nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)
    }
    
    /**
     * Desregistra totem
     */
    fun unregisterTotem() {
        registrationListener?.let {
            nsdManager.unregisterService(it)
        }
    }
    
    private fun getDeviceId(): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "unknown"
    }
}
```

**3. Integrar no PlayerViewModel:**
```kotlin
class PlayerViewModel(application: Application) : AndroidViewModel(application) {
    private val discoveryService = TotemDiscoveryService(application)
    
    fun initialize() {
        // ... código existente ...
        
        // Registrar totem via mDNS quando inicializar
        discoveryService.registerTotem(TOTEM_UIN, 8080)
    }
    
    override fun onCleared() {
        super.onCleared()
        // Desregistrar quando player parar
        discoveryService.unregisterTotem()
    }
}
```

**Vantagens:**
- ✅ Nativo do Android (NSD API)
- ✅ Zero configuração
- ✅ Funciona em Android TV Box

**Desvantagens:**
- ⚠️ Requer permissões específicas
- ⚠️ Pode não funcionar em redes corporativas restritivas

**Recomendação**: ✅ **Implementar** (alta prioridade)

---

#### SSDP (Android)
**Status**: ❌ Não implementado

**Implementação Sugerida:**

**1. Adicionar dependência:**
```gradle
dependencies {
    implementation 'org.fourthline.cling:cling-core:2.1.2'
    implementation 'org.fourthline.cling:cling-support:2.1.2'
}
```

**2. Implementar SSDP Service:**
```kotlin
// TotemSSDPService.kt
import org.fourthline.cling.UpnpService
import org.fourthline.cling.UpnpServiceImpl
import org.fourthline.cling.binding.LocalServiceBindingException
import org.fourthline.cling.binding.annotations.AnnotationLocalServiceBinder
import org.fourthline.cling.model.DefaultServiceManager
import org.fourthline.cling.model.meta.DeviceDetails
import org.fourthline.cling.model.meta.DeviceIdentity
import org.fourthline.cling.model.meta.LocalDevice
import org.fourthline.cling.model.meta.LocalService
import org.fourthline.cling.model.meta.ManufacturerDetails
import org.fourthline.cling.model.meta.ModelDetails
import org.fourthline.cling.model.types.DeviceType
import org.fourthline.cling.model.types.UDADeviceType
import org.fourthline.cling.model.types.UDN

class TotemSSDPService(private val context: Context) {
    private var upnpService: UpnpService? = null
    
    fun startSSDP(totemUIN: String, port: Int = 8080) {
        try {
            val deviceType = UDADeviceType("SmartDisplayPlayer", 1)
            val deviceId = UDN.uniqueSystemIdentifier("SmartDisplay-$totemUIN")
            
            val deviceDetails = DeviceDetails(
                "Smart Signage Totem",
                ManufacturerDetails("Smart Signage Solutions"),
                ModelDetails("Publisher", "2.1.0", "Totem Android")
            )
            
            val localDevice = LocalDevice(
                DeviceIdentity(deviceId),
                deviceType,
                deviceDetails,
                null, // icons
                null  // services
            )
            
            upnpService = UpnpServiceImpl()
            upnpService?.registry?.addDevice(localDevice)
            
            Log.i(TAG, "SSDP iniciado: $deviceId")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao iniciar SSDP", e)
        }
    }
    
    fun stopSSDP() {
        upnpService?.shutdown()
        upnpService = null
    }
}
```

**Vantagens:**
- ✅ Descobre capacidades (resolução, codecs, etc.)
- ✅ Padrão UPnP usado por Smart TVs

**Desvantagens:**
- ⚠️ Biblioteca externa (Cling)
- ⚠️ Mais complexo de implementar
- ⚠️ Pode ser bloqueado por firewalls

**Recomendação**: ⏳ **Implementar no futuro** (quando necessário)

---

### 3. Comparação: Linux/Windows vs Android

| Aspecto | Linux/Windows | Android |
|---------|----------------|---------|
| **mDNS** | Avahi (daemon) | NSD API (nativo) |
| **SSDP** | node-ssdp | Cling (biblioteca) |
| **Complexidade** | Média | Média-Alta |
| **Dependências** | Avahi instalado | NSD API (built-in) |
| **Recomendação** | ✅ Implementar | ✅ Implementar |

---

## 🎯 Recomendações por Plataforma

### Linux/Windows Totens

#### ✅ IMPLEMENTAR AGORA

1. **mDNS via Avahi**
   - Instalar `avahi-daemon`
   - Criar `/etc/avahi/services/smartdisplay.service`
   - Anunciar `Publisher-{hostname}.local`
   - **Prioridade**: 🔥 Alta

#### ⏳ IMPLEMENTAR FUTURAMENTE

2. **SSDP via node-ssdp**
   - Quando precisar anunciar capacidades
   - Quando Smart TVs precisarem descobrir capacidades
   - **Prioridade**: 🟡 Média

---

### Android Totens

#### ✅ IMPLEMENTAR AGORA

1. **mDNS via NSD API**
   - Usar `NsdManager` nativo do Android
   - Registrar serviço `_smartsignage-totem._tcp`
   - Anunciar atributos TXT (UIN, versão, etc.)
   - **Prioridade**: 🔥 Alta

#### ⏳ IMPLEMENTAR FUTURAMENTE

2. **SSDP via Cling**
   - Quando precisar anunciar capacidades detalhadas
   - Quando Smart TVs precisarem descobrir capacidades
   - **Prioridade**: 🟡 Média

---

## 📊 Matriz de Decisão Atualizada

| Plataforma | mDNS | SSDP | Scan | Recomendação |
|------------|------|------|------|--------------|
| **Linux** | ✅ Avahi | ⏳ node-ssdp | ✅ Básico | ✅ Implementar mDNS |
| **Windows** | ✅ Avahi | ⏳ node-ssdp | ✅ Básico | ✅ Implementar mDNS |
| **Android** | ✅ NSD API | ⏳ Cling | ✅ Básico | ✅ Implementar mDNS |

---

## 🔄 Fluxo Recomendado (Todas as Plataformas)

### Totens (Linux/Windows/Android)
```
1. Totem liga
2. Inicia servidor HTTP local (porta 8080)
3. Anuncia via mDNS:
   - Linux/Windows: Avahi
   - Android: NSD API
4. Smart TVs descobrem automaticamente
5. Totem continua se registrando via heartbeat (segurança)
```

### Smart TVs (webOS/Tizen)
```
1. TV liga
2. Descobre totem local via mDNS:
   - webOS: webOS.service.mdns
   - Tizen: SSDP ou mDNS
3. Testa conexão (/health)
4. Usa totem local se disponível
5. Fallback: servidor central
```

---

## 💡 Implementação Prática

### Linux/Windows (Node.js)

**Arquivo**: `player-client/platforms/linux-windows/mdns/MDNSAnnouncer.js`
```javascript
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class MDNSAnnouncer {
    constructor(options = {}) {
        this.totemUIN = options.totemUIN || '';
        this.port = options.port || 8080;
        this.hostname = os.hostname();
        this.serviceFile = '/etc/avahi/services/smartdisplay.service';
    }
    
    /**
     * Cria arquivo de serviço Avahi
     */
    async createServiceFile() {
        const xml = `<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">Publisher-${this.hostname}</name>
  <service>
    <type>_smartsignage-totem._tcp</type>
    <port>${this.port}</port>
    <txt-record>role=publisher</txt-record>
    <txt-record>player=${process.platform === 'win32' ? 'windows' : 'linux'}</txt-record>
    <txt-record>version=2.1.0</txt-record>
    <txt-record>totemUIN=${this.totemUIN}</txt-record>
  </service>
</service-group>`;
        
        try {
            await fs.writeFile(this.serviceFile, xml, { mode: 0o644 });
            console.log('[MDNS] Arquivo de serviço criado:', this.serviceFile);
            
            // Reiniciar Avahi para aplicar mudanças
            await this.restartAvahi();
        } catch (error) {
            console.error('[MDNS] Erro ao criar arquivo de serviço:', error);
            throw error;
        }
    }
    
    /**
     * Reinicia Avahi daemon
     */
    async restartAvahi() {
        return new Promise((resolve, reject) => {
            exec('sudo systemctl restart avahi-daemon', (error, stdout, stderr) => {
                if (error) {
                    console.error('[MDNS] Erro ao reiniciar Avahi:', error);
                    reject(error);
                } else {
                    console.log('[MDNS] Avahi reiniciado com sucesso');
                    resolve();
                }
            });
        });
    }
    
    /**
     * Remove arquivo de serviço
     */
    async removeServiceFile() {
        try {
            await fs.unlink(this.serviceFile);
            await this.restartAvahi();
            console.log('[MDNS] Serviço removido');
        } catch (error) {
            console.error('[MDNS] Erro ao remover serviço:', error);
        }
    }
}

module.exports = MDNSAnnouncer;
```

**Integração no player-app.js:**
```javascript
const MDNSAnnouncer = require('./mdns/MDNSAnnouncer');

class SmartSignagePlayer {
    async init() {
        // ... código existente ...
        
        // Registrar mDNS se Linux/Windows
        if (this.config.platform === 'linux' || this.config.platform === 'windows') {
            try {
                const mdns = new MDNSAnnouncer({
                    totemUIN: this.config.totemUIN,
                    port: this.config.httpServerPort
                });
                await mdns.createServiceFile();
                console.log('[Player] Totem registrado via mDNS');
            } catch (error) {
                console.warn('[Player] Falha ao registrar mDNS (pode precisar de sudo):', error);
            }
        }
    }
}
```

---

### Android (Kotlin)

**Arquivo**: `player-client/platforms/android/SmartSignage-ANDROID-PLAYER/app/src/main/java/com/smartsignage/player/discovery/TotemDiscoveryService.kt`
```kotlin
package com.smartsignage.player.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.provider.Settings
import android.util.Log

class TotemDiscoveryService(private val context: Context) {
    private val TAG = "TotemDiscoveryService"
    private val nsdManager: NsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var serviceInfo: NsdServiceInfo? = null
    
    /**
     * Registra totem via mDNS (NSD)
     */
    fun registerTotem(totemUIN: String, port: Int = 8080) {
        val deviceId = getDeviceId()
        val serviceName = "Publisher-$deviceId"
        
        serviceInfo = NsdServiceInfo().apply {
            this.serviceName = serviceName
            serviceType = "_smartsignage-totem._tcp"
            setPort(port)
            
            // Adicionar atributos TXT
            setAttribute("role", "publisher")
            setAttribute("player", "android")
            setAttribute("version", "2.1.0")
            setAttribute("totemUIN", totemUIN)
        }
        
        registrationListener = object : NsdManager.RegistrationListener {
            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "Falha ao registrar serviço mDNS: $errorCode")
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
                Log.i(TAG, "Totem registrado via mDNS: ${serviceInfo.serviceName}")
                Log.i(TAG, "Tipo: ${serviceInfo.serviceType}, Porta: ${serviceInfo.port}")
            }
            
            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                Log.i(TAG, "Totem desregistrado via mDNS")
            }
        }
        
        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)
            Log.i(TAG, "Tentando registrar serviço mDNS: $serviceName")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao registrar serviço mDNS", e)
        }
    }
    
    /**
     * Desregistra totem
     */
    fun unregisterTotem() {
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
    }
    
    /**
     * Obtém device ID único
     */
    private fun getDeviceId(): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "unknown"
    }
}
```

**Integração no PlayerViewModel:**
```kotlin
import com.smartsignage.player.discovery.TotemDiscoveryService

class PlayerViewModel(application: Application) : AndroidViewModel(application) {
    private val discoveryService = TotemDiscoveryService(application)
    
    fun initialize() {
        viewModelScope.launch {
            // ... código existente ...
            
            // Registrar totem via mDNS quando inicializar
            try {
                discoveryService.registerTotem(TOTEM_UIN, 8080)
            } catch (e: Exception) {
                Log.w(TAG, "Falha ao registrar mDNS (pode precisar de permissões)", e)
            }
        }
    }
    
    override fun onCleared() {
        super.onCleared()
        // Desregistrar quando player parar
        discoveryService.unregisterTotem()
    }
}
```

**Adicionar permissões no AndroidManifest.xml:**
```xml
<manifest>
    <!-- ... outras permissões ... -->
    
    <!-- Permissões para mDNS (NSD) -->
    <uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
</manifest>
```

---

## 📋 Checklist de Implementação

### Linux/Windows
- [ ] Instalar Avahi (`sudo apt install avahi-daemon avahi-utils`)
- [ ] Criar `MDNSAnnouncer.js`
- [ ] Integrar no `player-app.js`
- [ ] Testar descoberta via `avahi-browse -rt _smartsignage-totem._tcp`

### Android
- [ ] Criar `TotemDiscoveryService.kt`
- [ ] Adicionar permissões no `AndroidManifest.xml`
- [ ] Integrar no `PlayerViewModel`
- [ ] Testar descoberta via app de teste mDNS

---

## 🎯 Conclusão

### Totens Suportados
- ✅ **Linux**: mDNS via Avahi (recomendado implementar)
- ✅ **Windows**: mDNS via Avahi (recomendado implementar)
- ✅ **Android**: mDNS via NSD API (recomendado implementar)

### Próximo Passo
**Implementar mDNS em todas as plataformas de totens** para descoberta automática por Smart TVs.

**Benefício**: Zero configuração para Smart TVs descobrirem totens locais.

**Risco**: Baixo (apenas descoberta local, não afeta segurança do registro no backend).
