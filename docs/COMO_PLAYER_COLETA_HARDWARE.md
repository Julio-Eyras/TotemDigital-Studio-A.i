# Como o Player-Web-Cache Coleta Informações de Hardware

## 📋 Visão Geral

O player-web-cache coleta informações de hardware de **duas fontes diferentes**:

1. **Navegador (Client-Side)**: Informações que o navegador pode fornecer diretamente
2. **Servidor (Server-Side)**: Informações do servidor onde o backend está rodando

---

## 🔍 Fluxo de Coleta

### 1. Função `collectHardware()` (Client-Side)

**Localização:** `player-web-cache/index.html` (linhas 117-130)

```javascript
async function collectHardware() {
    try {
        // 1. TENTAR obter informações do SERVIDOR (backend)
        const r = await fetch(API_BASE + '/api/player/hardware-info');
        let h = r.ok ? await r.json() : {};
        
        // 2. Se servidor não retornou userAgent, usar do navegador
        if (!h.userAgent) {
            h = { 
                userAgent: navigator.userAgent, 
                platform: navigator.platform, 
                timestamp: Date.now() 
            };
        }
        
        // 3. Calcular hash SHA-256 das informações coletadas
        const str = JSON.stringify(h);
        const buf = new TextEncoder().encode(str);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        const hex = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        // 4. Retornar informações + hash
        return { ...h, hardwareHash: hex };
    } catch (e) {
        // Fallback: apenas informações do navegador
        return { 
            userAgent: navigator.userAgent, 
            platform: navigator.platform, 
            timestamp: Date.now() 
        };
    }
}
```

---

## 📊 Informações Coletadas

### A. Do Navegador (JavaScript APIs)

O navegador fornece diretamente:

| Propriedade | API JavaScript | Descrição | Exemplo |
|------------|----------------|-----------|---------|
| `userAgent` | `navigator.userAgent` | String identificando navegador/OS | `"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"` |
| `platform` | `navigator.platform` | Plataforma do sistema operacional | `"Win32"`, `"Linux x86_64"`, `"MacIntel"` |

**Limitações do Navegador:**
- ❌ **NÃO pode acessar MAC address** (por segurança)
- ❌ **NÃO pode acessar hostname** (por segurança)
- ❌ **NÃO pode acessar arquitetura** (limitado)
- ✅ Pode acessar `userAgent` e `platform`

### B. Do Servidor (Backend API)

**Endpoint:** `GET /api/player/hardware-info`

**Localização:** `backend/src/routes/player.ts` (linhas 1159-1191)

O backend executa comandos do sistema operacional para obter:

| Propriedade | Como é Obtido | Descrição |
|------------|---------------|-----------|
| `macAddress` | Comando `ip link show` ou `/sys/class/net/eth0/address` | Endereço MAC da primeira interface de rede ativa |
| `hostname` | `os.hostname()` (Node.js) | Nome do host do servidor |
| `platform` | `os.platform()` (Node.js) | Plataforma do SO (`linux`, `win32`, `darwin`) |
| `arch` | `os.arch()` (Node.js) | Arquitetura do processador (`x64`, `arm`, etc.) |

**Código do Backend:**

```typescript
router.get('/hardware-info', async (_req: Request, res: Response) => {
  try {
    let macAddress: string | null = null;
    
    // Tentar obter MAC address da primeira interface de rede ativa
    try {
      const { stdout } = await execAsync(
        'ip link show | grep -A1 "state UP" | grep -oE "([0-9a-f]{2}:){5}[0-9a-f]{2}" | head -1', 
        { timeout: 3000 }
      );
      macAddress = stdout.trim();
    } catch {
      // Fallback: usar MAC de eth0
      try {
        const { stdout } = await execAsync(
          'cat /sys/class/net/eth0/address 2>/dev/null || echo ""', 
          { timeout: 2000 }
        );
        macAddress = stdout.trim() || null;
      } catch {
        macAddress = null;
      }
    }

    return res.json({
      macAddress: macAddress,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch()
    });
  } catch (error: any) {
    await logError('Erro ao obter informações de hardware', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
```

---

## 🔐 Geração do Hardware Hash

Após coletar todas as informações, o player gera um **hash SHA-256** único:

```javascript
// 1. Serializar todas as informações coletadas
const str = JSON.stringify({
    macAddress: h.macAddress,
    hostname: h.hostname,
    platform: h.platform,
    arch: h.arch,
    userAgent: h.userAgent
});

// 2. Converter para ArrayBuffer
const buf = new TextEncoder().encode(str);

// 3. Calcular hash SHA-256 usando Web Crypto API
const hash = await crypto.subtle.digest('SHA-256', buf);

// 4. Converter para hexadecimal
const hex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

// 5. Adicionar ao objeto de hardware
return { ...h, hardwareHash: hex };
```

**Propósito do Hash:**
- ✅ Identificação única do hardware
- ✅ Prevenção de clonagem de totens
- ✅ Validação de integridade

---

## 📤 Uso das Informações

As informações coletadas são usadas em:

### 1. Geração de UIN (Unique Identifier Number)

**Função:** `generateUIN(hw)` (linha 132-143)

```javascript
async function generateUIN(hw) {
    const s = JSON.stringify({
        mac: hw.macAddress || hw.mac || 'unknown',
        hostname: hw.hostname || 'unknown',
        platform: hw.platform || 'unknown',
        hash: hw.hardwareHash || 'unknown'
    });
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return 'SSP-' + hex.substring(0, 16);
}
```

### 2. Registro/Aprovação de Totem

**Função:** `autoRegister(uin)` e `requestApprovalViaHeartbeat(uin, hardware)`

As informações são enviadas ao backend:

```javascript
{
    uin: "UIN-SHOPPING-001-2025",
    hardware: {
        macAddress: "aa:bb:cc:dd:ee:ff",
        hostname: "totem-001",
        platform: "linux",
        arch: "x64",
        hardwareHash: "a1b2c3d4e5f6...",
        userAgent: "Mozilla/5.0..."
    }
}
```

---

## ⚠️ Limitações e Considerações

### 1. Segurança do Navegador

Por questões de segurança, navegadores **NÃO permitem** acesso direto a:
- ❌ MAC address
- ❌ Hostname do cliente
- ❌ Informações sensíveis do sistema

**Solução:** O backend obtém essas informações do servidor onde está rodando.

### 2. Diferença entre Cliente e Servidor

**IMPORTANTE:** As informações coletadas são do **servidor onde o backend está rodando**, não do dispositivo cliente onde o navegador está executando.

- Se o player está rodando em um totem (smart-TV, Raspberry Pi, etc.), o backend precisa estar no mesmo dispositivo ou ter acesso às informações do dispositivo.
- Se o player está rodando em um navegador remoto, as informações serão do servidor backend, não do navegador.

### 3. Fallback e Tolerância a Falhas

O código tem múltiplos fallbacks:

1. Se `/api/player/hardware-info` falhar → usa apenas `navigator.userAgent` e `navigator.platform`
2. Se MAC address não for encontrado → retorna `null`
3. Se hash não puder ser calculado → usa informações básicas

---

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Player inicia (index.html)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. collectHardware() é chamado                              │
│    - Faz fetch para /api/player/hardware-info                │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│ Backend responde │         │ Fallback:         │
│ - macAddress     │         │ - navigator.      │
│ - hostname       │         │   userAgent       │
│ - platform       │         │ - navigator.      │
│ - arch           │         │   platform        │
└────────┬─────────┘         └────────┬─────────┘
         │                             │
         └──────────────┬──────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Calcula hardwareHash (SHA-256)                           │
│    - Combina todas as informações                           │
│    - Gera hash único                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Usa informações para:                                    │
│    - Gerar UIN (se necessário)                              │
│    - Registrar totem                                        │
│    - Solicitar aprovação                                    │
│    - Validar hardware                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Resumo

| Informação | Fonte | Como é Obtida |
|-----------|-------|---------------|
| `userAgent` | Navegador | `navigator.userAgent` |
| `platform` | Navegador + Servidor | `navigator.platform` + `os.platform()` |
| `macAddress` | Servidor | Comando `ip link show` ou `/sys/class/net/eth0/address` |
| `hostname` | Servidor | `os.hostname()` (Node.js) |
| `arch` | Servidor | `os.arch()` (Node.js) |
| `hardwareHash` | Calculado | SHA-256 de todas as informações acima |

---

## 🔗 Referências

- **Código do Player:** `player-web-cache/index.html` (função `collectHardware`)
- **Código do Backend:** `backend/src/routes/player.ts` (endpoint `/api/player/hardware-info`)
- **Web Crypto API:** [MDN - SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
- **Navigator API:** [MDN - Navigator](https://developer.mozilla.org/en-US/docs/Web/API/Navigator)
