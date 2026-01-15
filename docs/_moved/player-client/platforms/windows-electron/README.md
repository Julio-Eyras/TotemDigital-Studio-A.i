# Player Windows Electron

Player cliente para Windows usando Electron (reutiliza código do Linux Electron).

## 📋 Requisitos

- Node.js 18+
- npm 9+
- Windows 10+

## 🚀 Instalação

### 1. Instalar Dependências

```bash
cd platforms/windows-electron
npm install
```

### 2. Build

```bash
npm run build
```

Isso criará um instalador .exe em `dist/`

### 3. Instalar

Execute o instalador gerado em `dist/Smart Signage Player Setup 1.0.0.exe`

## 🔧 Configuração

### Variáveis de Ambiente

```cmd
set API_BASE_URL=http://localhost:3000
set TOTEM_UIN=your-uin
set TOTEM_SECRET=your-secret
```

### Auto-start

O instalador pode configurar auto-start automaticamente, ou configurar manualmente via:
- Task Scheduler do Windows
- Startup folder

## 📚 Documentação

- [Electron Documentation](https://www.electronjs.org/docs)

