# Guia de Desenvolvimento - SmartSignage Pro

## Estrutura do Projeto

```
SmartSignage-Pro/
├── backend/          # Backend Node.js/Express
│   ├── src/
│   │   ├── routes/   # Rotas da API
│   │   ├── services/ # Lógica de negócio
│   │   ├── config/   # Configurações
│   │   └── types/    # TypeScript types
│   └── dist/         # Build compilado
├── frontend/         # Frontend React
│   ├── src/
│   │   ├── pages/    # Páginas
│   │   ├── components/ # Componentes
│   │   └── services/ # Serviços API
│   └── build/        # Build de produção
├── player-web/       # Player HTML5
│   ├── js/           # JavaScript do player
│   ├── vinhetas/ # Vinhetas (fallback)
│   └── propagandas/ # Propagandas (fallback)
├── database/         # Scripts SQL
│   ├── migrations/   # Migrations
│   └── smartchannel-db-v2-refactored-*.sql
└── scripts/          # Scripts de instalação
```

## Configuração do Ambiente de Desenvolvimento

### Pré-requisitos

```bash
# Node.js 18+
node --version

# PostgreSQL 12+
psql --version

# Git
git --version
```

### Setup Inicial

```bash
# Clone o repositório
git clone <repository-url>
cd SmartSignage-Pro

# Backend
cd backend
npm install
cp .env.example .env
# Edite .env com suas configurações

# Frontend
cd ../frontend
npm install

# Database
cd ../database
# Configure conexão e execute schema
```

### Variáveis de Ambiente (Desenvolvimento)

`backend/.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartsignage_dev
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=dev_secret_change_in_production
LOG_LEVEL=debug
```

## Executando em Desenvolvimento

### Backend

```bash
cd backend
npm run dev
# ou
npm run watch  # Com hot reload
```

Backend roda em `http://localhost:3000`

### Frontend

```bash
cd frontend
npm start
# ou
npm run dev
```

Frontend roda em `http://localhost:5173` (Vite) ou `http://localhost:3001`

### Player

```bash
# Servir player-web localmente
cd player-web
python3 -m http.server 8080
# ou
npx serve .
```

Player acessível em `http://localhost:8080`

## Estrutura de Código

### Backend

#### Rotas (`backend/src/routes/`)

```typescript
// Exemplo: campaigns.ts
import { Router } from 'express';
import { CampaignService } from '../services/campaignService';

const router = Router();

router.get('/', async (req, res) => {
  const service = new CampaignService();
  const campaigns = await service.getCampaigns(req.query);
  res.json({ success: true, data: campaigns });
});

export default router;
```

#### Serviços (`backend/src/services/`)

```typescript
// Exemplo: campaignService.ts
export class CampaignService {
  private get db() {
    return getDatabase();
  }

  async getCampaigns(filters: any) {
    return this.db.findMany(`
      SELECT * FROM campaigns
      WHERE is_active = true
      ${filters.status ? `AND status = $1` : ''}
    `, filters.status ? [filters.status] : []);
  }
}
```

#### Tipos (`backend/src/types/`)

```typescript
// Exemplo: campaign.types.ts
export interface Campaign {
  campaignId: number;
  title: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'active' | 'paused';
  // ...
}
```

### Frontend

#### Componentes (`frontend/src/components/`)

```typescript
// Exemplo: CampaignCard.tsx
import React from 'react';

interface CampaignCardProps {
  campaign: Campaign;
  onEdit: (id: number) => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onEdit }) => {
  return (
    <div className="campaign-card">
      <h3>{campaign.title}</h3>
      <button onClick={() => onEdit(campaign.id)}>Editar</button>
    </div>
  );
};
```

#### Serviços API (`frontend/src/services/`)

```typescript
// Exemplo: api/campaigns.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Authorization': `Bearer ${getToken()}`
  }
});

export const getCampaigns = async () => {
  const response = await api.get('/campaigns');
  return response.data;
};
```

## Padrões de Código

### Nomenclatura

- **Arquivos**: camelCase para TypeScript/JavaScript, kebab-case para outros
- **Classes**: PascalCase (`CampaignService`)
- **Funções/Variáveis**: camelCase (`getCampaigns`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`)

### Estrutura de Commits

```
tipo(escopo): descrição curta

Descrição detalhada (opcional)

Fixes #123
```

**Tipos:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `refactor`: Refatoração
- `test`: Testes
- `chore`: Tarefas de manutenção

### Tratamento de Erros

```typescript
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error: any) {
  await logError('Operação falhou', error, { context });
  return {
    success: false,
    error: error.message || 'Erro desconhecido'
  };
}
```

## Testes

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
```

## Algoritmos Importantes

### Dispatcher (Resolução de Conflitos)

**Localização**: `backend/src/services/dispatcherTotemService.ts`

**Processo**:
1. Busca candidatos (campanhas válidas)
2. Validação temporal (horário/dia válido?)
3. Validação comercial (tier, time share)
4. Validação técnica (mídia compatível?)
5. Calcula score para cada candidato
6. Seleciona vencedor (maior prioridade/score)
7. Gera plano de exibição

**Score Calculation**:
```typescript
score = basePriority 
  + (tier === 'premium' ? 20 : tier === 'standard' ? 10 : 0)
  + (timeRemainingPercent * 0.1)
  - (lastShownMinutesAgo * 0.01)
```

### Cache do Dispatcher

**Chave**: `dispatcher:totem:{totemId}:{timestampMinuto}`

**TTL**: 60 segundos

**Estratégia**: Cache por minuto (timestamp arredondado)

## Debugging

### Backend

```typescript
// Logs estruturados
await logDebug('Operação iniciada', { userId, campaignId });
await logError('Erro na operação', error, { context });
```

**Ver logs**:
```bash
# Systemd
sudo journalctl -u smart-signage -f

# PM2
pm2 logs smart-signage
```

### Frontend

```typescript
// Console logs (apenas desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info', data);
}
```

**React DevTools**: Instale extensão do navegador

### Player

```javascript
// Logs no console do navegador
console.log('[Player] Debug info', data);
```

## Performance

### Otimizações de Banco

- Use índices para queries frequentes
- Views materializadas para analytics
- Paginação em listas grandes

### Otimizações de Frontend

- Lazy loading de componentes
- Code splitting por rota
- Memoização de componentes pesados

### Otimizações de Player

- Cache local (IndexedDB)
- Download em background
- Streaming enquanto baixa

## Próximos Passos

- [API](./01-api.md) - Documentação da API
- [Migração](./03-migracao.md) - Guia de migração
- [Arquitetura](../platform/01-arquitetura.md) - Arquitetura do sistema
