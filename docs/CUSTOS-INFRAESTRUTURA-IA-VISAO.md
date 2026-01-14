# Custos de Infraestrutura e IA de Visão Computacional
## Smart Signage Pro - Análise Detalhada de Custos

**Versão:** 1.0  
**Data:** Janeiro 2026  
**Última Atualização:** Janeiro 2026

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Custos de Infraestrutura Cloud](#custos-de-infraestrutura-cloud)
3. [Custos de IA de Visão (APIs Cloud)](#custos-de-ia-de-visão-apis-cloud)
4. [Hardware Físico para IA Local](#hardware-físico-para-ia-local)
5. [Comparação: Cloud vs On-Premise](#comparação-cloud-vs-on-premise)
6. [Cenários de Uso e Estimativas](#cenários-de-uso-e-estimativas)
7. [Otimizações e Redução de Custos](#otimizações-e-redução-de-custos)
8. [ROI e Análise Financeira](#roi-e-análise-financeira)
9. [Recomendações Estratégicas](#recomendações-estratégicas)

---

## 🎯 Visão Geral

Este documento apresenta uma análise detalhada dos custos envolvidos na operação do Smart Signage Pro, considerando:

- **Infraestrutura Cloud**: Servidores, banco de dados, storage, rede
- **IA de Visão Computacional**: APIs cloud (Google Vision, AWS Rekognition, Azure)
- **Hardware Físico**: GPUs para processamento local de IA
- **Cenários Reais**: Diferentes volumes de uso e necessidades

### Premissas Base

- **Moeda**: USD (Dólar Americano) - valores podem variar por região
- **Período**: Estimativas mensais (podem ser convertidas para anuais)
- **Região**: Preços baseados em regiões padrão (US-East, US-West)
- **Nota**: Preços podem variar até 50% em regiões como Brasil

---

## ☁️ Custos de Infraestrutura Cloud

### 1. Computação (VMs e Instâncias)

#### Backend API e Workers

| **Provedor** | **Tipo de Instância** | **Especificações** | **Preço/hora** | **Preço/mês** | **Uso Recomendado** |
|--------------|----------------------|-------------------|----------------|---------------|---------------------|
| **AWS EC2** | t3.xlarge | 4 vCPU, 16 GB RAM | $0.1664 | ~$120 | Desenvolvimento, produção pequena |
| **AWS EC2** | t3.2xlarge | 8 vCPU, 32 GB RAM | $0.3328 | ~$240 | Produção média (50-100 totens) |
| **AWS EC2** | m5.2xlarge | 8 vCPU, 32 GB RAM | $0.384 | ~$277 | Produção alta (100-200 totens) |
| **GCP** | e2-standard-4 | 4 vCPU, 16 GB RAM | $0.134 | ~$97 | Desenvolvimento |
| **GCP** | e2-standard-8 | 8 vCPU, 32 GB RAM | $0.268 | ~$193 | Produção média |
| **Azure** | D4as v5 | 4 vCPU, 16 GB RAM | $0.192 | ~$138 | Desenvolvimento |
| **Azure** | D8as v5 | 8 vCPU, 32 GB RAM | $0.384 | ~$277 | Produção média |

**Observações:**
- Preços podem variar com **Reserved Instances** (até 40% desconto)
- **Spot Instances** podem reduzir custos em até 70% (não recomendado para produção crítica)
- Custos de **transferência de dados** não incluídos

#### Instâncias GPU (para IA Local na Cloud)

| **Provedor** | **Tipo de Instância** | **GPU** | **Especificações** | **Preço/hora** | **Preço/mês** |
|--------------|----------------------|---------|-------------------|----------------|---------------|
| **AWS EC2** | g4dn.xlarge | NVIDIA T4 | 4 vCPU, 16 GB RAM, 1x T4 | $0.526 | ~$379 |
| **AWS EC2** | g4dn.2xlarge | NVIDIA T4 | 8 vCPU, 32 GB RAM, 1x T4 | $0.752 | ~$541 |
| **AWS EC2** | g5.xlarge | NVIDIA A10G | 4 vCPU, 16 GB RAM, 1x A10G | $1.006 | ~$724 |
| **GCP** | n1-standard-4 + T4 | NVIDIA T4 | 4 vCPU, 15 GB RAM, 1x T4 | $0.35 | ~$252 |
| **GCP** | n1-standard-8 + T4 | NVIDIA T4 | 8 vCPU, 30 GB RAM, 1x T4 | $0.70 | ~$504 |
| **Azure** | NC6s v3 | NVIDIA V100 | 6 vCPU, 112 GB RAM, 1x V100 | $3.06 | ~$2,203 |
| **Azure** | NCas T4 v3 | NVIDIA T4 | 4 vCPU, 28 GB RAM, 1x T4 | $0.40 | ~$288 |

**Observações:**
- GPUs são **caras** - considere usar apenas quando necessário
- **Preemptible/Spot** podem reduzir custos em até 80% (mas podem ser interrompidas)
- Para produção, considere **Reserved Instances** (até 60% desconto)

### 2. Banco de Dados

#### PostgreSQL Gerenciado

| **Provedor** | **Tipo** | **Especificações** | **Preço/mês** | **Uso Recomendado** |
|--------------|----------|-------------------|---------------|---------------------|
| **AWS RDS** | db.t3.medium | 2 vCPU, 4 GB RAM, 100 GB | ~$75 | Desenvolvimento |
| **AWS RDS** | db.t3.large | 2 vCPU, 8 GB RAM, 200 GB | ~$150 | Produção pequena |
| **AWS RDS** | db.t3.xlarge | 4 vCPU, 16 GB RAM, 500 GB | ~$300 | Produção média |
| **GCP Cloud SQL** | db-f1-micro | 1 vCPU, 0.6 GB RAM, 10 GB | ~$7 | Desenvolvimento |
| **GCP Cloud SQL** | db-n1-standard-2 | 2 vCPU, 7.5 GB RAM, 100 GB | ~$100 | Produção pequena |
| **GCP Cloud SQL** | db-n1-standard-4 | 4 vCPU, 15 GB RAM, 500 GB | ~$200 | Produção média |
| **Azure Database** | Basic | 2 vCores, 5 GB RAM, 32 GB | ~$25 | Desenvolvimento |
| **Azure Database** | General Purpose | 4 vCores, 20 GB RAM, 128 GB | ~$200 | Produção média |

**Custos Adicionais:**
- **Storage**: ~$0.10-0.15/GB/mês
- **Backups**: ~$0.095/GB/mês
- **Transferência**: Primeiros 5 GB gratuitos, depois ~$0.09/GB

### 3. Armazenamento (Object Storage)

#### Armazenamento de Mídias (Imagens e Vídeos)

| **Provedor** | **Tipo** | **Preço/GB/mês** | **Primeiros 50 GB** | **Exemplo: 2 TB** |
|--------------|----------|------------------|---------------------|-------------------|
| **AWS S3** | Standard | $0.023 | Gratuito | ~$46/mês |
| **AWS S3** | Infrequent Access | $0.0125 | - | ~$25/mês |
| **GCP Cloud Storage** | Standard | $0.020 | Gratuito | ~$40/mês |
| **GCP Cloud Storage** | Nearline | $0.010 | - | ~$20/mês |
| **Azure Blob** | Hot | $0.0184 | Gratuito | ~$37/mês |
| **Azure Blob** | Cool | $0.01 | - | ~$20/mês |

**Custos Adicionais:**
- **Requests (GET/PUT)**: ~$0.0004 por 1.000 requests
- **Transferência de saída**: ~$0.09/GB (primeiros 5 GB gratuitos)

### 4. Rede e Transferência de Dados

#### Transferência de Dados (Egress)

| **Volume Mensal** | **AWS** | **GCP** | **Azure** | **Observações** |
|-------------------|---------|---------|-----------|-----------------|
| **Primeiros 5 GB** | Gratuito | Gratuito | Gratuito | Sempre gratuito |
| **5-10 TB** | $0.09/GB | $0.12/GB | $0.0875/GB | Preço padrão |
| **10-40 TB** | $0.085/GB | $0.11/GB | $0.08/GB | Desconto volume |
| **40+ TB** | $0.07/GB | $0.08/GB | $0.065/GB | Desconto alto volume |

**Exemplo Prático:**
- **100 totens** servindo vídeos: ~500 GB/mês = ~$45/mês
- **200 totens**: ~1 TB/mês = ~$90/mês
- **500 totens**: ~2.5 TB/mês = ~$225/mês

### 5. Cache e Filas (Redis)

| **Provedor** | **Tipo** | **Especificações** | **Preço/mês** |
|--------------|----------|-------------------|---------------|
| **AWS ElastiCache** | cache.t3.micro | 0.5 GB RAM | ~$15 |
| **AWS ElastiCache** | cache.t3.small | 1.4 GB RAM | ~$30 |
| **AWS ElastiCache** | cache.t3.medium | 3.1 GB RAM | ~$60 |
| **GCP Memorystore** | Basic | 1 GB RAM | ~$30 |
| **GCP Memorystore** | Standard | 5 GB RAM | ~$150 |
| **Azure Cache** | Basic C0 | 250 MB RAM | ~$15 |
| **Azure Cache** | Standard C1 | 1 GB RAM | ~$55 |

**Observação:** Redis é **opcional** mas **altamente recomendado** para performance.

### 6. Resumo de Infraestrutura Cloud Base

#### Cenário Pequeno (50 totens)
```
VM Backend (t3.xlarge):          $120/mês
PostgreSQL (db.t3.large):        $150/mês
Storage (500 GB):                 $10/mês
Transferência (200 GB):           $18/mês
Redis (cache.t3.small):           $30/mês
─────────────────────────────────────────
TOTAL:                            ~$328/mês
```

#### Cenário Médio (100-150 totens)
```
VM Backend (t3.2xlarge):         $240/mês
PostgreSQL (db.t3.xlarge):       $300/mês
Storage (2 TB):                  $46/mês
Transferência (1 TB):            $90/mês
Redis (cache.t3.medium):         $60/mês
─────────────────────────────────────────
TOTAL:                            ~$736/mês
```

#### Cenário Grande (200+ totens)
```
VM Backend (m5.2xlarge):         $277/mês
PostgreSQL (db.t3.xlarge):       $300/mês
Storage (5 TB):                  $115/mês
Transferência (2.5 TB):          $225/mês
Redis (cache.t3.medium):         $60/mês
─────────────────────────────────────────
TOTAL:                            ~$977/mês
```

---

## 👁️ Custos de IA de Visão (APIs Cloud)

### 1. Google Cloud Vision API

#### Preços por Funcionalidade (Janeiro 2026)

| **Funcionalidade** | **Preço por 1.000 unidades** | **Unidade** | **Exemplo de Custo** |
|-------------------|------------------------------|-------------|---------------------|
| **Label Detection** | $1.50 | Por imagem | 100k imagens = $150 |
| **Face Detection** | $1.50 | Por imagem | 100k imagens = $150 |
| **Text Detection (OCR)** | $1.50 | Por imagem | 100k imagens = $150 |
| **Safe Search Detection** | $1.50 | Por imagem | 100k imagens = $150 |
| **Landmark Detection** | $1.50 | Por imagem | 100k imagens = $150 |
| **Logo Detection** | $1.50 | Por imagem | 100k imagens = $150 |
| **Object Localization** | $1.50 | Por imagem | 100k imagens = $150 |
| **Product Search** | $1.50 | Por imagem | 100k imagens = $150 |
| **Web Detection** | $1.50 | Por imagem | 100k imagens = $150 |
| **Crop Hints** | $1.50 | Por imagem | 100k imagens = $150 |
| **Document Text Detection** | $1.50 | Por 1.000 páginas | 100k páginas = $150 |
| **Image Properties** | $1.50 | Por imagem | 100k imagens = $150 |

**Descontos:**
- **Tier 1** (0-5M/mês): Preço padrão
- **Tier 2** (5M-20M/mês): 20% desconto
- **Tier 3** (20M+): 40% desconto

**Exemplo Prático:**
- **50 totens**, análise 1x/hora = 50 × 24 × 30 = **36.000 imagens/mês**
- Custo: 36 × $1.50 = **$54/mês** (apenas label detection)
- Com múltiplas detecções (face + label + text): **$162/mês**

### 2. AWS Rekognition

#### Preços por Funcionalidade

| **Funcionalidade** | **Preço por 1.000 unidades** | **Unidade** | **Exemplo de Custo** |
|-------------------|------------------------------|-------------|---------------------|
| **DetectLabels** | $1.00 | Por imagem | 100k imagens = $100 |
| **DetectFaces** | $1.00 | Por imagem | 100k imagens = $100 |
| **DetectText** | $1.00 | Por imagem | 100k imagens = $100 |
| **DetectModerationLabels** | $1.00 | Por imagem | 100k imagens = $100 |
| **DetectCustomLabels** | $1.00 | Por imagem | 100k imagens = $100 |
| **RecognizeCelebrities** | $1.00 | Por imagem | 100k imagens = $100 |
| **CompareFaces** | $1.00 | Por comparação | 100k comparações = $100 |
| **SearchFaces** | $1.00 | Por busca | 100k buscas = $100 |
| **DetectProtectiveEquipment** | $1.00 | Por imagem | 100k imagens = $100 |
| **Video Analysis** | $0.10 | Por minuto | 1.000 min = $100 |

**Descontos:**
- **Free Tier**: 5.000 imagens/mês gratuitas (primeiros 12 meses)
- **Volume Discounts**: Disponível para uso acima de 1M/mês

**Exemplo Prático:**
- **100 totens**, análise 1x/hora = 100 × 24 × 30 = **72.000 imagens/mês**
- Custo: (72 - 5) × $1.00 = **$67/mês** (apenas face detection)
- Com múltiplas detecções: **$200-300/mês**

### 3. Azure Computer Vision

#### Preços por Funcionalidade

| **Funcionalidade** | **Preço por 1.000 transações** | **Exemplo de Custo** |
|-------------------|-------------------------------|---------------------|
| **Analyze Image** | $1.00 | 100k análises = $100 |
| **OCR (Read)** | $1.00 | 100k páginas = $100 |
| **Detect Objects** | $1.00 | 100k imagens = $100 |
| **Detect Brands** | $1.00 | 100k imagens = $100 |
| **Describe Image** | $1.00 | 100k imagens = $100 |
| **Generate Thumbnail** | $1.00 | 100k thumbnails = $100 |
| **Get Area of Interest** | $1.00 | 100k análises = $100 |

**Azure Custom Vision:**
- **Treinamento**: $2.00/hora
- **Previsão**: $1.00 por 1.000 transações
- **Armazenamento**: $0.50 por 1.000 imagens

**Exemplo Prático:**
- **150 totens**, análise 2x/hora = 150 × 48 × 30 = **216.000 imagens/mês**
- Custo: 216 × $1.00 = **$216/mês**

### 4. Comparação de Custos de Visão

#### Cenário: 100 totens, análise 1x/hora (72.000 imagens/mês)

| **Provedor** | **Custo Base** | **Com Descontos** | **Melhor Para** |
|--------------|----------------|-------------------|-----------------|
| **Google Vision** | $108/mês | $86/mês (Tier 2) | Análise geral, OCR |
| **AWS Rekognition** | $67/mês | $54/mês (volume) | Face detection, custom labels |
| **Azure Vision** | $72/mês | $58/mês (volume) | Integração Microsoft |

**Recomendação:** AWS Rekognition oferece melhor custo-benefício para uso moderado.

---

## 🖥️ Hardware Físico para IA Local

### 1. GPUs para Processamento Local

#### Opções de GPU (NVIDIA)

| **Modelo GPU** | **VRAM** | **Performance (TFLOPS)** | **Preço Aproximado** | **Uso Recomendado** |
|----------------|----------|-------------------------|---------------------|-------------------|
| **RTX 3060** | 12 GB | 13 TFLOPS (FP32) | $300-400 | Desenvolvimento, POC |
| **RTX 3060 Ti** | 8 GB | 16 TFLOPS (FP32) | $400-500 | Desenvolvimento |
| **RTX 3070** | 8 GB | 20 TFLOPS (FP32) | $500-600 | Produção pequena |
| **RTX 3080** | 10 GB | 30 TFLOPS (FP32) | $700-900 | Produção média |
| **RTX 3090** | 24 GB | 36 TFLOPS (FP32) | $1,500-2,000 | Produção alta |
| **RTX 4060** | 8 GB | 15 TFLOPS (FP32) | $300-400 | Desenvolvimento |
| **RTX 4070** | 12 GB | 29 TFLOPS (FP32) | $600-700 | Produção média |
| **RTX 4080** | 16 GB | 49 TFLOPS (FP32) | $1,200-1,400 | Produção alta |
| **RTX 4090** | 24 GB | 83 TFLOPS (FP32) | $1,600-2,000 | Produção enterprise |
| **A100 (40GB)** | 40 GB | 312 TFLOPS (FP16) | $10,000-15,000 | Data center |
| **A100 (80GB)** | 80 GB | 312 TFLOPS (FP16) | $15,000-20,000 | Data center |

**Observações:**
- **RTX série 30/40**: Melhor custo-benefício para IA local
- **A100**: Apenas para data centers, muito caro para uso geral
- **VRAM**: Importante para modelos grandes (Stable Diffusion precisa 8GB+)

#### Performance Esperada por GPU

| **GPU** | **Inferência Face Detection** | **Inferência Object Detection** | **Treinamento (batch)** |
|---------|-------------------------------|--------------------------------|------------------------|
| **RTX 3060** | ~50-80 FPS | ~30-50 FPS | ~2-4 horas/epoca |
| **RTX 3070** | ~80-120 FPS | ~50-70 FPS | ~1-2 horas/epoca |
| **RTX 3080** | ~120-180 FPS | ~70-100 FPS | ~30-60 min/epoca |
| **RTX 3090** | ~180-250 FPS | ~100-150 FPS | ~15-30 min/epoca |
| **RTX 4090** | ~300-400 FPS | ~200-300 FPS | ~5-15 min/epoca |

### 2. Configurações de Servidor Recomendadas

#### Configuração Básica (Desenvolvimento/POC)

```
CPU: Intel i5-12400 / AMD Ryzen 5 5600X        $150-200
GPU: NVIDIA RTX 3060 (12 GB)                   $350
RAM: 32 GB DDR4                                $100
SSD: 1 TB NVMe                                 $80
Motherboard: Compatível PCIe 4.0               $150
PSU: 650W 80+ Gold                             $100
Case + Cooling                                 $100
─────────────────────────────────────────────────────
TOTAL:                                         ~$1,030
```

**Capacidade:**
- Processar ~50-100 imagens/minuto
- Suporta 10-20 totens com análise contínua
- Ideal para desenvolvimento e testes

#### Configuração Média (Produção Pequena)

```
CPU: Intel i7-13700K / AMD Ryzen 7 7700X       $350-400
GPU: NVIDIA RTX 4070 (12 GB)                  $650
RAM: 64 GB DDR5                                $250
SSD: 2 TB NVMe                                 $150
Motherboard: Z790 / X670E                     $250
PSU: 850W 80+ Gold                             $150
Case + Cooling (AIO)                           $200
─────────────────────────────────────────────────────
TOTAL:                                         ~$2,000
```

**Capacidade:**
- Processar ~150-250 imagens/minuto
- Suporta 50-100 totens com análise contínua
- Ideal para produção pequena/média

#### Configuração Alta (Produção Enterprise)

```
CPU: Intel i9-13900K / AMD Ryzen 9 7950X      $600-700
GPU: NVIDIA RTX 4090 (24 GB)                  $1,800
RAM: 128 GB DDR5                               $500
SSD: 4 TB NVMe                                 $300
Motherboard: Z790 / X670E (premium)            $400
PSU: 1200W 80+ Platinum                       $250
Case + Cooling (AIO premium)                   $300
─────────────────────────────────────────────────────
TOTAL:                                         ~$4,150
```

**Capacidade:**
- Processar ~400-600 imagens/minuto
- Suporta 200+ totens com análise contínua
- Ideal para produção enterprise

#### Configuração Multi-GPU (Data Center)

```
CPU: AMD EPYC 7543 (32 cores)                 $2,500
GPU: 2x NVIDIA RTX 4090 (24 GB cada)          $3,600
RAM: 256 GB DDR4 ECC                           $1,500
SSD: 8 TB NVMe                                 $600
Motherboard: EPYC compatible                    $800
PSU: 1600W 80+ Platinum                         $400
Case + Cooling (rack mount)                    $500
─────────────────────────────────────────────────────
TOTAL:                                         ~$9,900
```

**Capacidade:**
- Processar ~800-1200 imagens/minuto
- Suporta 500+ totens com análise contínua
- Ideal para data center próprio

### 3. Custos Operacionais de Hardware

#### Eletricidade

| **Configuração** | **Consumo (Watts)** | **kWh/mês** | **Custo/mês (R$0,50/kWh)** |
|------------------|---------------------|-------------|---------------------------|
| **Básica (RTX 3060)** | ~300W | 216 kWh | R$ 108 (~$22) |
| **Média (RTX 4070)** | ~400W | 288 kWh | R$ 144 (~$29) |
| **Alta (RTX 4090)** | ~600W | 432 kWh | R$ 216 (~$43) |
| **Multi-GPU (2x RTX 4090)** | ~1000W | 720 kWh | R$ 360 (~$72) |

**Observação:** Custos podem variar significativamente por região.

#### Manutenção e Depreciação

| **Item** | **Custo Anual** | **Observações** |
|----------|----------------|-----------------|
| **Manutenção Preventiva** | $100-200 | Limpeza, troca de pasta térmica |
| **Substituição de Componentes** | $200-500 | Fonte, coolers, etc. |
| **Depreciação (3 anos)** | 33% do valor | Hardware perde valor |
| **Suporte Técnico** | $500-1,000 | Se contratado externamente |

**Exemplo:** Servidor de $2,000
- Depreciação anual: $660
- Manutenção: $300
- **Total anual:** ~$960 (~$80/mês)

### 4. Comparação: Hardware vs Cloud GPU

#### Cenário: 100 totens, análise 1x/hora

**Opção 1: Cloud GPU (AWS g4dn.2xlarge)**
```
Instância: $541/mês
Transferência: $50/mês
─────────────────────
TOTAL: $591/mês
```

**Opção 2: Hardware Próprio (RTX 4070)**
```
Hardware inicial: $2,000 (amortizado em 3 anos)
Eletricidade: $29/mês
Manutenção: $8/mês (amortizada)
─────────────────────
TOTAL: $55/mês (após amortização)
TOTAL primeiro ano: $195/mês (incluindo hardware)
```

**Break-even:** ~4 meses (hardware se paga em relação à cloud)

**Recomendação:** 
- **Uso < 6 meses**: Cloud GPU
- **Uso > 6 meses**: Hardware próprio
- **Uso > 2 anos**: Hardware próprio é muito mais econômico

---

## ⚖️ Comparação: Cloud vs On-Premise

### Tabela Comparativa Completa

| **Aspecto** | **Cloud (APIs)** | **Cloud (GPU)** | **On-Premise (Hardware)** |
|-------------|------------------|-----------------|---------------------------|
| **Custo Inicial** | $0 | $0 | $1,000-4,000 |
| **Custo Mensal (100 totens)** | $67-108 | $591 | $55-195 |
| **Escalabilidade** | ✅ Ilimitada | ✅ Fácil | ⚠️ Limitada |
| **Manutenção** | ✅ Zero | ✅ Zero | ❌ Necessária |
| **Latência** | ⚠️ 100-500ms | ⚠️ 50-200ms | ✅ <10ms |
| **Privacidade** | ⚠️ Dados na cloud | ⚠️ Dados na cloud | ✅ Dados locais |
| **Confiabilidade** | ✅ 99.9% SLA | ✅ 99.9% SLA | ⚠️ Depende de infra |
| **Flexibilidade** | ⚠️ Limitada | ✅ Boa | ✅ Total |
| **Custo Total (3 anos)** | $2,400-3,900 | $21,276 | $1,980-7,020 |

### Recomendação por Cenário

#### Cenário 1: POC / Desenvolvimento
- **Recomendação:** Cloud APIs (Google Vision / AWS Rekognition)
- **Razão:** Custo zero inicial, fácil de testar, sem compromisso

#### Cenário 2: Produção Pequena (50-100 totens)
- **Recomendação:** Hardware próprio (RTX 4070)
- **Razão:** Break-even rápido, privacidade, latência baixa

#### Cenário 3: Produção Média (100-200 totens)
- **Recomendação:** Híbrido (Hardware + Cloud como backup)
- **Razão:** Melhor dos dois mundos, redundância

#### Cenário 4: Produção Grande (200+ totens)
- **Recomendação:** Hardware próprio (Multi-GPU) + Cloud como fallback
- **Razão:** Custo-benefício, controle total, escalabilidade

---

## 📊 Cenários de Uso e Estimativas

### Cenário A: Conservador (POC / Início)

**Configuração:**
- 50 totens
- Análise visual: 1x/hora por totem
- Uso de APIs cloud (AWS Rekognition)

**Custos Mensais:**
```
Infraestrutura Cloud:        $328
IA Visão (36k imagens):      $31
IA Texto (chat, etc):        $50
─────────────────────────────────
TOTAL:                       $409/mês
```

**Hardware Alternativo:**
```
Hardware RTX 3060:           $1,030 (único)
Eletricidade:                $22/mês
─────────────────────────────────
TOTAL primeiro ano:          $110/mês (amortizado)
```

### Cenário B: Balanceado (Produção Média)

**Configuração:**
- 100 totens
- Análise visual: 2x/hora por totem
- Hardware próprio (RTX 4070) + Cloud como backup

**Custos Mensais:**
```
Infraestrutura Cloud:        $736
Hardware (amortizado):       $55/mês
Eletricidade:                $29/mês
IA Cloud (backup):           $50/mês
IA Texto:                    $150/mês
─────────────────────────────────
TOTAL:                       $1,020/mês
```

### Cenário C: Agressivo (Produção Enterprise)

**Configuração:**
- 200 totens
- Análise visual: 4x/hora por totem
- Hardware próprio (RTX 4090) + Cloud para picos

**Custos Mensais:**
```
Infraestrutura Cloud:        $977
Hardware (amortizado):       $138/mês
Eletricidade:                $43/mês
IA Cloud (picos):            $200/mês
IA Texto/Avançada:           $500/mês
─────────────────────────────────
TOTAL:                       $1,858/mês
```

### Cenário D: Máxima Escala (Data Center)

**Configuração:**
- 500+ totens
- Análise visual: 6x/hora por totem
- Multi-GPU on-premise + Cloud distribuída

**Custos Mensais:**
```
Infraestrutura Cloud:        $2,500
Hardware Multi-GPU:          $275/mês (amortizado)
Eletricidade:                $72/mês
IA Cloud (distribuída):      $1,000/mês
IA Texto/Avançada:           $1,500/mês
─────────────────────────────────
TOTAL:                       $5,347/mês
```

---

## 💡 Otimizações e Redução de Custos

### 1. Otimizações de Infraestrutura

#### Cache Agressivo
- **Impacto:** Reduz chamadas de API em 60-80%
- **Economia:** $40-80/mês (dependendo do volume)
- **Implementação:** Redis com TTL inteligente

#### Compressão de Imagens
- **Impacto:** Reduz transferência em 70-90%
- **Economia:** $30-100/mês (dependendo do volume)
- **Implementação:** Compressão antes do upload

#### Batch Processing
- **Impacto:** Reduz custos de API em 20-30%
- **Economia:** $15-50/mês
- **Implementação:** Agrupar múltiplas análises

#### Reserved Instances
- **Impacto:** Desconto de 40-60% em VMs
- **Economia:** $50-200/mês
- **Implementação:** Compromisso de 1-3 anos

### 2. Otimizações de IA

#### Modelos Mais Leves
- **Impacto:** Reduz custos de inferência em 50-70%
- **Economia:** $30-100/mês
- **Exemplo:** Usar YOLOv8n ao invés de YOLOv8x

#### Processamento Local Quando Possível
- **Impacto:** Elimina custos de API para casos simples
- **Economia:** $50-200/mês
- **Implementação:** OpenCV + modelos locais

#### Cache de Resultados
- **Impacto:** Evita reprocessar imagens similares
- **Economia:** $20-80/mês
- **Implementação:** Hash de imagem + cache

#### Rate Limiting Inteligente
- **Impacto:** Processa apenas quando necessário
- **Economia:** $30-100/mês
- **Implementação:** Detecção de movimento antes de processar

### 3. Otimizações de Hardware

#### Underclocking/Undervolting
- **Impacto:** Reduz consumo em 20-30%
- **Economia:** $5-15/mês (eletricidade)
- **Risco:** Pode reduzir performance

#### Processamento Assíncrono
- **Impacto:** Melhor utilização de GPU
- **Economia:** Permite hardware menor
- **Implementação:** Fila de processamento

#### Modelos Quantizados
- **Impacto:** Reduz uso de VRAM e aumenta throughput
- **Economia:** Permite GPU menor
- **Implementação:** INT8 ao invés de FP32

---

## 💰 ROI e Análise Financeira

### Análise de Retorno sobre Investimento

#### Cenário: 100 totens, Hardware vs Cloud

**Opção 1: Cloud GPU (AWS g4dn.2xlarge)**
```
Custo mensal: $591
Custo anual: $7,092
Custo 3 anos: $21,276
```

**Opção 2: Hardware Próprio (RTX 4070)**
```
Investimento inicial: $2,000
Custo mensal (op): $55
Custo anual (op): $660
Custo 3 anos: $3,980
```

**ROI:**
- **Economia 3 anos:** $17,296
- **ROI:** 765% em 3 anos
- **Payback:** 4 meses

### Análise de Break-Even

#### Cloud APIs vs Hardware Próprio

**Volume necessário para break-even:**

| **Volume Mensal** | **Cloud APIs** | **Hardware** | **Break-Even** |
|-------------------|----------------|--------------|----------------|
| **10k imagens** | $10/mês | $55/mês | ❌ Cloud melhor |
| **50k imagens** | $50/mês | $55/mês | ⚠️ Próximo |
| **100k imagens** | $100/mês | $55/mês | ✅ Hardware melhor |
| **200k imagens** | $200/mês | $55/mês | ✅ Hardware muito melhor |

**Conclusão:** Acima de **50-70k imagens/mês**, hardware próprio é mais econômico.

### Projeção de Custos por Crescimento

#### Crescimento de 50 → 500 totens (3 anos)

| **Ano** | **Totens** | **Cloud APIs** | **Hardware** | **Economia** |
|---------|------------|----------------|--------------|--------------|
| **Ano 1** | 50-100 | $409-820/mês | $110-195/mês | $299-625/mês |
| **Ano 2** | 100-250 | $820-2,050/mês | $195-275/mês | $625-1,775/mês |
| **Ano 3** | 250-500 | $2,050-4,100/mês | $275-550/mês | $1,775-3,550/mês |

**Economia Total 3 Anos:** ~$30,000-60,000

---

## 🎯 Recomendações Estratégicas

### Fase 1: Início (0-50 totens)
✅ **Usar Cloud APIs** (AWS Rekognition ou Google Vision)
- Custo zero inicial
- Fácil de escalar
- Sem manutenção
- **Custo:** ~$400-500/mês

### Fase 2: Crescimento (50-150 totens)
✅ **Migrar para Hardware Próprio** (RTX 4070)
- Break-even em 4-6 meses
- Melhor privacidade
- Latência menor
- **Custo:** ~$1,000-1,200/mês (incluindo infra)

### Fase 3: Escala (150-300 totens)
✅ **Hardware Multi-GPU** (2x RTX 4090)
- Máxima economia
- Controle total
- Performance superior
- **Custo:** ~$1,800-2,500/mês

### Fase 4: Enterprise (300+ totens)
✅ **Híbrido** (Hardware + Cloud distribuída)
- Redundância
- Escalabilidade global
- Otimização de custos
- **Custo:** ~$3,000-5,000/mês

### Estratégia de Implementação Recomendada

```
Mês 1-3:   Cloud APIs (testes, validação)
Mês 4-6:   Adquirir hardware RTX 4070
Mês 7-12:  Migração gradual para hardware
Ano 2:     Upgrade para RTX 4090 se necessário
Ano 3:     Multi-GPU se escala justificar
```

---

## 📝 Resumo Executivo

### Custos Totais Estimados (Mensal)

| **Cenário** | **Infra Cloud** | **IA Visão** | **Hardware** | **TOTAL** |
|-------------|----------------|--------------|--------------|-----------|
| **POC (50 totens)** | $328 | $31 | $0 | **$359/mês** |
| **Produção Média (100 totens)** | $736 | $55 | $55 | **$846/mês** |
| **Produção Alta (200 totens)** | $977 | $138 | $138 | **$1,253/mês** |
| **Enterprise (500 totens)** | $2,500 | $275 | $275 | **$3,050/mês** |

### Recomendação Final

**Para Smart Signage Pro v2.1:**

1. **Início (0-6 meses):** Cloud APIs (AWS Rekognition)
2. **Crescimento (6-12 meses):** Hardware RTX 4070
3. **Escala (12+ meses):** Hardware RTX 4090 ou Multi-GPU

**Economia Projetada:** $15,000-30,000 em 3 anos comparado a usar apenas cloud.

---

**Documento criado em:** Janeiro 2026  
**Próxima revisão:** Trimestral (ou quando houver mudanças significativas de preços)  
**Versão:** 1.0
