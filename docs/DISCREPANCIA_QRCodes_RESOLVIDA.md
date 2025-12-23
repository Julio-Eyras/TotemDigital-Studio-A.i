# Discrepância do Schema QR Codes - RESOLVIDA ✅

## Problema Identificado

O schema v2 refatorado tinha uma estrutura muito simplificada para `qr_codes`:
- Apenas: `qr_id`, `campaign_id`, `code`, `url`, `image_url`, `scan_count`, `last_scan_at`

O código atual usava uma estrutura mais completa:
- `qr_code_id`, `client_id`, `totem_id`, `campaign_id`, `title`, `description`, `qr_type`, `content`, `size`, `color`, `background_color`, `error_correction_level`, `margin`, `expires_at`, `max_scans`, `redirect_url`, `tracking_enabled`, etc.

## Solução Implementada

### 1. Schema Atualizado ✅

O schema v2 foi expandido para incluir todos os campos necessários:

```sql
CREATE TABLE IF NOT EXISTS qr_codes (
    qr_id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL, -- FK para campaigns (QR code pertence a uma campanha)
    
    -- Identificação
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Tipo e conteúdo
    qr_type TEXT DEFAULT 'url', -- 'url', 'text', 'wifi', 'contact', 'sms', 'email', 'phone'
    content TEXT NOT NULL,
    url TEXT,
    redirect_url TEXT,
    
    -- Aparência
    size INTEGER DEFAULT 200,
    color TEXT DEFAULT '#000000',
    background_color TEXT DEFAULT '#FFFFFF',
    error_correction_level TEXT DEFAULT 'M',
    margin INTEGER DEFAULT 4,
    
    -- Imagem gerada
    image_url TEXT,
    
    -- Tracking e limites
    scan_count INTEGER DEFAULT 0,
    last_scan_at TIMESTAMP,
    max_scans INTEGER,
    tracking_enabled BOOLEAN DEFAULT true,
    
    -- Validade
    expires_at TIMESTAMP,
    
    -- Metadados extras
    metadata JSONB DEFAULT '{}'::jsonb,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_qr_type CHECK (qr_type IN ('url', 'text', 'wifi', 'contact', 'sms', 'email', 'phone')),
    CONSTRAINT chk_error_correction_level CHECK (error_correction_level IN ('L', 'M', 'Q', 'H'))
);
```

### 2. Código Atualizado ✅

- ✅ Todas as referências de `qr_code_id` → `qr_id`
- ✅ Removido `client_id` (QR codes pertencem a campaigns, que pertencem a subscribers)
- ✅ Removido `totem_id` (QR codes são globais, não específicos de totem)
- ✅ Queries atualizadas para usar `subscribers` via `campaigns`
- ✅ Métodos atualizados: `getQRCodes`, `getQRCodeById`, `createQRCode`, `updateQRCode`, `deleteQRCode`
- ✅ Método `recordScan` atualizado (não usa mais `qr_code_scans` - usar `event_logs` ou criar tabela depois)

### 3. Índices Adicionados ✅

```sql
CREATE INDEX IF NOT EXISTS idx_qr_codes_campaign ON qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_active ON qr_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires ON qr_codes(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(qr_type);
```

## Notas Importantes

1. **Tabela `qr_code_scans`:** Não existe no schema v2. Para histórico detalhado de scans, use `event_logs` ou crie a tabela depois se necessário.

2. **Compatibilidade:** Mantida onde possível (ex: `clientId` mapeado para `subscriberId` via `campaigns`)

3. **Geração de Imagem:** QR code image é gerada em base64 e salva no `metadata`. TODO: Salvar em disco/storage e atualizar `image_url`.

## Status

✅ **RESOLVIDO** - Schema e código agora estão alinhados.

