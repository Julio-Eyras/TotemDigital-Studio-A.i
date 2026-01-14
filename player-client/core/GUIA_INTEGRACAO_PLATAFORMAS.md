# Guia de Integração por Plataforma

Este guia mostra como integrar o sistema de cache e download de mídias em cada plataforma.

## 📋 Índice

1. [Linux/Windows/Electron (Node.js)](#linuxwindowselectron-nodejs)
2. [Android](#android)
3. [webOS](#webos)
4. [Tizen](#tizen)
5. [Browser (player-web)](#browser-player-web)

---

## Linux/Windows/Electron (Node.js)

### Requisitos

- Node.js 18+
- Acesso ao sistema de arquivos

### Implementação

```javascript
const DispatcherIntegration = require('./core/examples/DispatcherIntegrationExample');
const { createFileSystemAdapter } = require('./core/adapters/FileSystemAdapter');
const { createStorageAdapter } = require('./core/adapters/StorageAdapter');

// Inicializar
const integration = new DispatcherIntegration({
  baseURL: 'http://localhost:3000',
  uin: 'TOTEM-001',
  totemSecret: 'secret-key',
  deviceId: 'device-123',
  platform: 'linux', // ou 'windows', 'electron'
  appVersion: '2.1.0',
  cacheDir: './cache'
});

await integration.initialize();

// Sincronizar DispatchPlan
const plan = await integration.syncDispatchPlan();

// Iniciar sincronização automática (15 minutos)
integration.startAutoSync(900000);

// Iniciar servidor HTTP local (totem)
// O servidor será iniciado automaticamente se shouldStartLocalServer() retornar true
```

### Estrutura de Diretórios

```
cache/
├── media/
│   ├── 1_abc123.mp4
│   ├── 2_def456.jpg
│   └── ...
├── metadata.json
└── dispatch_plan.json
```

---

## Android

### Requisitos

- Android 5.0+ (API 21+)
- Permissões de armazenamento
- WebView ou JNI bridge para acesso ao sistema de arquivos

### Implementação Kotlin

```kotlin
// MainActivity.kt
import android.webkit.WebView
import android.webkit.JavascriptInterface

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val androidBridge = AndroidBridge()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = findViewById(R.id.webview)
        webView.settings.javaScriptEnabled = true
        
        // Expor bridge para JavaScript
        webView.addJavascriptInterface(androidBridge, "AndroidBridge")
        
        // Carregar HTML/JS do player
        webView.loadUrl("file:///android_asset/player/index.html")
    }
}

// AndroidBridge.kt
class AndroidBridge {
    private val context: Context = getApplicationContext()
    private val cacheDir = File(context.getExternalFilesDir(null), "cache")
    
    @JavascriptInterface
    fun ensureDir(path: String): Boolean {
        val dir = File(cacheDir, path)
        return dir.mkdirs()
    }
    
    @JavascriptInterface
    fun writeFile(path: String, base64Data: String): Boolean {
        return try {
            val file = File(cacheDir, path)
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            file.writeBytes(bytes)
            true
        } catch (e: Exception) {
            false
        }
    }
    
    @JavascriptInterface
    fun readFile(path: String): String {
        val file = File(cacheDir, path)
        val bytes = file.readBytes()
        return Base64.encodeToString(bytes, Base64.DEFAULT)
    }
    
    @JavascriptInterface
    fun fileExists(path: String): Boolean {
        val file = File(cacheDir, path)
        return file.exists()
    }
    
    @JavascriptInterface
    fun deleteFile(path: String): Boolean {
        val file = File(cacheDir, path)
        return file.delete()
    }
    
    @JavascriptInterface
    fun fileStat(path: String): String {
        val file = File(cacheDir, path)
        val stat = JSONObject().apply {
            put("size", file.length())
            put("lastModified", file.lastModified())
        }
        return stat.toString()
    }
    
    @JavascriptInterface
    fun listFiles(dirPath: String): String {
        val dir = File(cacheDir, dirPath)
        val files = dir.listFiles()?.map { it.name } ?: emptyList()
        return JSONArray(files).toString()
    }
    
    // Storage (SharedPreferences)
    @JavascriptInterface
    fun setPreference(key: String, value: String) {
        val prefs = context.getSharedPreferences("smartsignage", Context.MODE_PRIVATE)
        prefs.edit().putString(key, value).apply()
    }
    
    @JavascriptInterface
    fun getPreference(key: String): String? {
        val prefs = context.getSharedPreferences("smartsignage", Context.MODE_PRIVATE)
        return prefs.getString(key, null)
    }
}
```

### Implementação JavaScript

```javascript
// No WebView/HTML
const androidBridge = window.AndroidBridge;

const integration = new DispatcherIntegration({
  baseURL: 'http://your-server:3000',
  uin: 'TOTEM-001',
  totemSecret: 'secret-key',
  deviceId: android.provider.Settings.Secure.ANDROID_ID,
  platform: 'android',
  appVersion: '2.1.0',
  cacheDir: '/sdcard/SmartSignage/cache',
  androidBridge: {
    call: async (method, args) => {
      return new Promise((resolve, reject) => {
        try {
          const result = androidBridge[method](...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    }
  }
});

await integration.initialize();
```

### Permissões (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## webOS

### Requisitos

- webOS 3.0+
- FileSystem API disponível

### Implementação

```javascript
// app.js
const DispatcherIntegration = require('./core/examples/DispatcherIntegrationExample');
const { createFileSystemAdapter } = require('./core/adapters/FileSystemAdapter');
const { createStorageAdapter } = require('./core/adapters/StorageAdapter');

// Obter deviceId do webOS
const deviceId = webOS.deviceInfo().deviceId || 'webos-device';

const integration = new DispatcherIntegration({
  baseURL: 'http://your-server:3000',
  uin: 'TOTEM-001',
  totemSecret: 'secret-key',
  deviceId: deviceId,
  platform: 'webos',
  appVersion: '2.1.0',
  cacheDir: '/media/developer/smartsignage/cache'
});

await integration.initialize();

// webOS não deve iniciar servidor HTTP local (é uma TV)
// Apenas sincronizar e usar cache leve
const plan = await integration.syncDispatchPlan();
```

### appinfo.json

```json
{
  "id": "com.smartsignage.player",
  "version": "2.1.0",
  "type": "web",
  "main": "index.html",
  "title": "Smart Signage Player",
  "requiredPermissions": [
    "media.read",
    "media.write",
    "network.operation"
  ]
}
```

### Limitações

- Cache limitado pelo sandbox do app (~100-500 MB)
- Sem servidor HTTP local (buscar mídias do totem)
- FileSystem API pode ter restrições

---

## Tizen

### Requisitos

- Tizen 3.0+
- FileSystem API disponível

### Implementação

```javascript
// app.js
const DispatcherIntegration = require('./core/examples/DispatcherIntegrationExample');

// Obter deviceId do Tizen
const deviceId = tizen.systeminfo.getCapability("http://tizen.org/system/tizenid");

const integration = new DispatcherIntegration({
  baseURL: 'http://your-server:3000',
  uin: 'TOTEM-001',
  totemSecret: 'secret-key',
  deviceId: deviceId,
  platform: 'tizen',
  appVersion: '2.1.0',
  cacheDir: '/home/owner/smartsignage/cache'
});

await integration.initialize();
```

### config.xml

```xml
<tizen:application id="com.smartsignage.player" package="com.smartsignage" version="2.1.0">
  <tizen:content src="index.html"/>
  <tizen:privilege name="http://tizen.org/privilege/filesystem.read"/>
  <tizen:privilege name="http://tizen.org/privilege/filesystem.write"/>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
</tizen:application>
```

### Limitações

- Cache limitado pelo sandbox do app (~100-500 MB)
- Sem servidor HTTP local (buscar mídias do totem)
- FileSystem API pode ter restrições

---

## Browser (player-web)

### Requisitos

- Browser moderno com IndexedDB
- Sem acesso ao sistema de arquivos

### Implementação

```javascript
// index.html
<script src="core/api/client.js"></script>
<script src="core/cache/MediaDownloader.js"></script>
<script src="core/adapters/FileSystemAdapter.js"></script>
<script src="core/adapters/StorageAdapter.js"></script>

<script>
// Gerar deviceId estável
const deviceId = localStorage.getItem('deviceId') || 
  btoa(navigator.userAgent + screen.width + screen.height).substring(0, 16);
localStorage.setItem('deviceId', deviceId);

const integration = new DispatcherIntegration({
  baseURL: window.location.origin,
  uin: getUINFromURL(), // Ex: ?uin=TOTEM-001
  totemSecret: null, // Não usado em browser
  deviceId: deviceId,
  platform: 'browser',
  appVersion: '2.1.0',
  cacheDir: 'cache' // Virtual (IndexedDB)
});

await integration.initialize();

// Browser não deve iniciar servidor HTTP local
// Apenas sincronizar e usar cache em memória/IndexedDB
const plan = await integration.syncDispatchPlan();
```

### Limitações

- Sem cache persistente pesado (IndexedDB limitado)
- Sem servidor HTTP local
- Streaming direto do backend/totem
- Cache apenas durante sessão

---

## 🔧 Configuração Comum

### Variáveis de Ambiente

```javascript
const config = {
  baseURL: process.env.SERVER_URL || 'http://localhost:3000',
  uin: process.env.TOTEM_UIN || 'TOTEM-001',
  totemSecret: process.env.TOTEM_SECRET || 'secret-key',
  deviceId: process.env.DEVICE_ID || generateDeviceId(),
  platform: detectPlatform(), // 'linux', 'android', 'webos', 'tizen', 'browser'
  appVersion: process.env.APP_VERSION || '2.1.0',
  cacheDir: process.env.CACHE_DIR || './cache',
  
  // Opções do MediaDownloader
  maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE) || 32 * 1024 * 1024 * 1024,
  syncInterval: parseInt(process.env.SYNC_INTERVAL) || 900000, // 15 minutos
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000 // 30 segundos
};
```

### Detecção de Plataforma

```javascript
function detectPlatform() {
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform; // 'linux', 'win32', 'darwin'
  }
  
  if (typeof webOS !== 'undefined') {
    return 'webos';
  }
  
  if (typeof tizen !== 'undefined') {
    return 'tizen';
  }
  
  if (typeof Android !== 'undefined' || window.AndroidBridge) {
    return 'android';
  }
  
  return 'browser';
}
```

---

## 📝 Checklist de Integração

### Para Todas as Plataformas

- [ ] Obter `uin` do totem/TV
- [ ] Gerar/obter `deviceId` único
- [ ] Detectar `platform` corretamente
- [ ] Configurar `baseURL` do backend
- [ ] Inicializar `DispatcherIntegration`
- [ ] Implementar sincronização periódica
- [ ] Implementar heartbeat
- [ ] Tratar modo offline

### Para Totens (Linux/Windows/Android Box)

- [ ] Configurar cache completo (32GB+)
- [ ] Iniciar servidor HTTP local
- [ ] Implementar limpeza LRU
- [ ] Validar checksums

### Para Smart TVs (webOS/Tizen)

- [ ] Configurar cache leve (< 500MB)
- [ ] Buscar mídias do totem via HTTP local
- [ ] Implementar fallback para totem offline
- [ ] Não iniciar servidor HTTP local

### Para Browser (player-web)

- [ ] Usar IndexedDB para cache
- [ ] Streaming direto do backend
- [ ] Cache apenas durante sessão
- [ ] Não iniciar servidor HTTP local

---

## 🔗 Ver Também

- `core/cache/README.md` - Documentação do sistema de cache
- `core/examples/DispatcherIntegrationExample.js` - Exemplo completo
- `docs/GUIA_INTEGRACAO_PLAYER_DISPATCHER.md` - Guia de integração
- `docs/ARQUITETURA-CACHE-ARMAZENAMENTO-LOCAL.md` - Arquitetura completa
