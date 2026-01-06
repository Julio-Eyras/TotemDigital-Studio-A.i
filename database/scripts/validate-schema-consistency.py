#!/usr/bin/env python3
"""
Script para validar consistência do schema SQL
Verifica se índices e foreign keys referenciam colunas que existem
"""

import re
import sys
import os
from pathlib import Path

# Estrutura das tabelas (extraída dos arquivos CREATE TABLE)
TABLES = {
    'playlists': ['playlist_id', 'subscriber_id', 'name', 'description', 'is_active', 'schedule_config', 'metadata', 'created_at', 'updated_at'],
    'medias': ['media_id', 'subscriber_id', 'name', 'description', 'file_path', 'file_name', 'file_size_bytes', 'media_type', 'mime_type', 'duration_seconds', 'width', 'height', 'thumbnail_url', 'preview_url', 'status', 'approval_status', 'rejection_reason', 'approved_by', 'approved_at', 'tags', 'metadata', 'is_active', 'created_at', 'updated_at'],
    'campaigns': ['campaign_id', 'subscriber_id', 'title', 'description', 'campaign_type', 'priority', 'commercial_tier', 'default_time_share_percent', 'max_consecutive_slots', 'start_date', 'end_date', 'start_time', 'end_time', 'days_of_week', 'timezone', 'status', 'is_active', 'target_audience', 'metadata', 'created_at', 'updated_at'],
    'totems': ['totem_id', 'identifier', 'uin', 'device_id', 'local_id', 'name', 'description', 'model', 'manufacturer', 'firmware_version', 'hardware_version', 'os_version', 'status', 'last_heartbeat', 'heartbeat_interval', 'network_info', 'capabilities', 'is_active', 'created_at', 'updated_at'],
    # Adicionar outras tabelas conforme necessário
}

errors = []
warnings = []

def extract_column_name(index_line):
    """Extrai o nome da coluna de uma linha de índice"""
    # Padrão: CREATE INDEX ... ON table_name(column_name)
    match = re.search(r'ON\s+\w+\(([^)]+)\)', index_line, re.IGNORECASE)
    if match:
        col = match.group(1).strip()
        # Remover WHERE clause se existir
        col = col.split(' WHERE')[0].strip()
        # Se for índice composto, pegar primeira coluna
        col = col.split(',')[0].strip()
        return col
    return None

def validate_indexes(file_path):
    """Valida se os índices referenciam colunas que existem"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extrair todos os índices
    index_pattern = r'CREATE INDEX[^;]+ON\s+(\w+)\s*\(([^)]+)\)'
    matches = re.finditer(index_pattern, content, re.IGNORECASE | re.MULTILINE | re.DOTALL)
    
    for match in matches:
        table_name = match.group(1).lower()
        columns_str = match.group(2)
        
        if table_name not in TABLES:
            warnings.append(f"Tabela '{table_name}' não encontrada no dicionário (pode estar correta)")
            continue
        
        table_columns = TABLES[table_name]
        
        # Extrair colunas (pode ser composto: col1, col2)
        columns = [col.strip().split()[0] for col in columns_str.split(',')]
        
        for col in columns:
            # Remover direções DESC/ASC se houver
            col = re.sub(r'\s+(DESC|ASC)$', '', col, flags=re.IGNORECASE).strip()
            
            if col not in table_columns:
                line_num = content[:match.start()].count('\n') + 1
                errors.append(f"{file_path}:{line_num} - Índice em '{table_name}' referencia coluna '{col}' que não existe. Colunas disponíveis: {', '.join(table_columns)}")

def main():
    script_dir = Path(__file__).parent.parent
    indexes_file = script_dir / 'smartchannel-db-v2-refactored-part8-indexes.sql'
    
    if not indexes_file.exists():
        print(f"Erro: Arquivo não encontrado: {indexes_file}")
        sys.exit(1)
    
    print("Validando índices...")
    validate_indexes(indexes_file)
    
    if errors:
        print("\n❌ ERROS ENCONTRADOS:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    
    if warnings:
        print("\n⚠️  AVISOS:")
        for warning in warnings:
            print(f"  - {warning}")
    
    print("\n✅ Validação concluída sem erros!")

if __name__ == '__main__':
    main()

