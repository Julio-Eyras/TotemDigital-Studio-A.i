# Dependências e Licenças - Player Cliente

## 📋 Resumo Executivo

**✅ NENHUMA BIBLIOTECA PAGA É UTILIZADA**

O player cliente foi desenvolvido usando apenas:
- **JavaScript Vanilla** (sem frameworks)
- **APIs nativas** das plataformas (webOS, Tizen)
- **HTML5 nativo** (video, image, iframe)
- **Fetch API nativo** (sem bibliotecas HTTP)

## 🔍 Análise por Plataforma

### 1. webOS (LG Smart TVs)

#### Bibliotecas Utilizadas:
- ❌ **Nenhuma biblioteca externa**
- ✅ JavaScript Vanilla
- ✅ HTML5 Video/Image/Iframe
- ✅ Fetch API
- ✅ webOS TV SDK (GRATUITO)

#### SDKs e Ferramentas:
- **webOS TV SDK**: ✅ **GRATUITO**
  - Disponível em: https://webostv.developer.lge.com/
  - Download e uso são gratuitos
  - Não requer licença paga

#### Certificados:
- **Certificado de Desenvolvedor LG**:
  - **Desenvolvimento**: ✅ Gratuito
  - **Publicação no LG Content Store**: 
    - Pode ter taxas de publicação (verificar LG Developer Portal)
    - Não é obrigatório para uso interno/privado

#### Código Utilizado:
```javascript
// Apenas APIs nativas do webOS
webOS.service.request('luna://com.webos.service.tvpower', {...})
```

**Custo Total: R$ 0,00** (para desenvolvimento e uso interno)

---

### 2. Tizen (Samsung Smart TVs)

#### Bibliotecas Utilizadas:
- ❌ **Nenhuma biblioteca externa**
- ✅ JavaScript Vanilla
- ✅ HTML5 Video/Image/Iframe
- ✅ Fetch API
- ✅ Tizen TV SDK (GRATUITO)

#### SDKs e Ferramentas:
- **Tizen Studio**: ✅ **GRATUITO**
  - Disponível em: https://developer.tizen.org/
  - Download e uso são gratuitos
  - Não requer licença paga

#### Certificados:
- **Certificado de Desenvolvedor Samsung**:
  - **Desenvolvimento**: ✅ Gratuito
  - **Publicação no Samsung App Store**:
    - Pode ter taxas de publicação (verificar Samsung Developer Portal)
    - Não é obrigatório para uso interno/privado

#### Código Utilizado:
```javascript
// Apenas APIs nativas do Tizen
tizen.tvinputdevice.getSupportedKeys()
```

**Custo Total: R$ 0,00** (para desenvolvimento e uso interno)

---

### 3. Android TV

#### Bibliotecas Utilizadas:
- ❌ **Nenhuma biblioteca externa paga**
- ✅ Kotlin/Java padrão
- ✅ Android TV SDK (GRATUITO)
- ✅ ExoPlayer (GRATUITO - Apache 2.0)

#### SDKs e Ferramentas:
- **Android Studio**: ✅ **GRATUITO**
- **Android TV SDK**: ✅ **GRATUITO**
- **ExoPlayer**: ✅ **GRATUITO** (Apache 2.0 License)

#### Certificados:
- **Google Play Console**:
  - Taxa única de registro: $25 USD (uma vez)
  - Não é obrigatório para uso interno/privado

**Custo Total: R$ 0,00** (para desenvolvimento e uso interno)
**Custo para publicação: $25 USD** (apenas se publicar na Play Store)

---

### 4. Linux (Electron)

#### Bibliotecas Utilizadas:
- ❌ **Nenhuma biblioteca externa paga**
- ✅ Electron (GRATUITO - MIT License)
- ✅ Node.js (GRATUITO)
- ✅ JavaScript Vanilla

#### SDKs e Ferramentas:
- **Electron**: ✅ **GRATUITO** (MIT License)
- **Node.js**: ✅ **GRATUITO**

**Custo Total: R$ 0,00**

---

### 5. Linux (C++)

#### Bibliotecas Utilizadas:
- ❌ **Nenhuma biblioteca externa paga**
- ✅ C++ padrão
- ✅ OpenCV (opcional, GRATUITO - Apache 2.0)
- ✅ FFmpeg (opcional, GRATUITO - LGPL)

#### SDKs e Ferramentas:
- **GCC/Clang**: ✅ **GRATUITO**
- **CMake**: ✅ **GRATUITO**

**Custo Total: R$ 0,00**

---

### 6. Windows (Electron)

#### Bibliotecas Utilizadas:
- ❌ **Nenhuma biblioteca externa paga**
- ✅ Electron (GRATUITO - MIT License)
- ✅ Node.js (GRATUITO)

**Custo Total: R$ 0,00**

---

## 📊 Tabela Comparativa

| Plataforma | SDK | Licença SDK | Bibliotecas Externas | Custo Desenvolvimento | Custo Publicação |
|------------|-----|-------------|---------------------|----------------------|------------------|
| **webOS (LG)** | webOS TV SDK | ✅ Gratuito | ❌ Nenhuma | **R$ 0,00** | Variável* |
| **Tizen (Samsung)** | Tizen Studio | ✅ Gratuito | ❌ Nenhuma | **R$ 0,00** | Variável* |
| **Android TV** | Android TV SDK | ✅ Gratuito | ExoPlayer (Gratuito) | **R$ 0,00** | $25 USD* |
| **Linux Electron** | Electron | ✅ Gratuito (MIT) | ❌ Nenhuma | **R$ 0,00** | N/A |
| **Linux C++** | GCC/CMake | ✅ Gratuito | ❌ Nenhuma | **R$ 0,00** | N/A |
| **Windows Electron** | Electron | ✅ Gratuito (MIT) | ❌ Nenhuma | **R$ 0,00** | N/A |

\* Apenas se publicar nas lojas oficiais. Não é necessário para uso interno/privado.

---

## ✅ Conclusão

### Para Desenvolvimento e Uso Interno:
**CUSTO TOTAL: R$ 0,00**

- Todos os SDKs são gratuitos
- Todas as ferramentas são gratuitas
- Nenhuma biblioteca paga é utilizada
- Apenas código próprio e APIs nativas

### Para Publicação em Lojas:
- **LG Content Store**: Verificar taxas no portal (geralmente gratuita para apps)
- **Samsung App Store**: Verificar taxas no portal (geralmente gratuita para apps)
- **Google Play Store**: $25 USD (taxa única de registro)

### Recomendações:

1. **Para uso interno/privado**: 
   - ✅ **Sem custos**
   - Instalar diretamente nas TVs via desenvolvimento
   - Não precisa publicar nas lojas

2. **Para distribuição pública**:
   - Verificar políticas de cada loja
   - Considerar custos de certificação (se houver)
   - Avaliar necessidade de publicação vs. instalação direta

---

## 📝 Licenças das Ferramentas

### webOS TV SDK
- **Licença**: Proprietária (LG)
- **Uso**: Gratuito para desenvolvimento
- **Restrições**: Apenas para desenvolvimento de apps webOS

### Tizen Studio
- **Licença**: Apache 2.0 / Proprietária (Samsung)
- **Uso**: Gratuito para desenvolvimento
- **Restrições**: Apenas para desenvolvimento de apps Tizen

### Electron
- **Licença**: MIT License
- **Uso**: Gratuito (comercial e não-comercial)
- **Restrições**: Nenhuma

### ExoPlayer (Android)
- **Licença**: Apache 2.0
- **Uso**: Gratuito (comercial e não-comercial)
- **Restrições**: Nenhuma

---

## 🔒 Segurança e Compliance

- ✅ Todas as dependências são de código aberto ou SDKs oficiais
- ✅ Nenhuma biblioteca de terceiros não verificada
- ✅ Apenas APIs nativas das plataformas
- ✅ Sem telemetria ou rastreamento de terceiros

---

## 📞 Suporte

Para dúvidas sobre licenças ou custos:
- **LG Developer Portal**: https://webostv.developer.lge.com/
- **Samsung Developer Portal**: https://developer.tizen.org/
- **Google Play Console**: https://play.google.com/console/

