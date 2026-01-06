#!/usr/bin/env python3
"""
Script para tornar todas as constraints idempotentes no part7-foreign-keys.sql
"""

import re

def convert_constraint_to_idempotent(match):
    """Converte um ALTER TABLE ADD CONSTRAINT para formato idempotente"""
    table_name = match.group(1)
    constraint_name = match.group(2)
    constraint_def = match.group(3).rstrip(';').strip()
    
    return f'''DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = '{constraint_name}'
        AND t.relname = '{table_name}'
    ) THEN
        ALTER TABLE {table_name}
            ADD CONSTRAINT {constraint_name} 
            {constraint_def};
    END IF;
END $$;'''

def process_file(input_file, output_file):
    """Processa o arquivo SQL e torna todas as constraints idempotentes"""
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Padrão para encontrar ALTER TABLE ... ADD CONSTRAINT que não estão dentro de DO blocks
    # Procura por ALTER TABLE que não está precedido por "THEN" (dentro de DO block)
    pattern = r'^(\s*)ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+(\w+)\s+(FOREIGN KEY[^;]+);'
    
    def replace_func(match):
        indent = match.group(1)
        table_name = match.group(2)
        constraint_name = match.group(3)
        constraint_def = match.group(4).rstrip(';').strip()
        
        # Verificar se já está dentro de um DO block (procurar por "THEN" antes)
        pos = match.start()
        before = content[:pos]
        # Se encontrar "THEN" próximo antes, não substituir
        if 'THEN' in before[-200:]:
            return match.group(0)
        
        return f'''{indent}DO $$ 
{indent}BEGIN
{indent}    IF NOT EXISTS (
{indent}        SELECT 1 FROM pg_constraint c
{indent}        JOIN pg_class t ON c.conrelid = t.oid
{indent}        WHERE c.conname = '{constraint_name}'
{indent}        AND t.relname = '{table_name}'
{indent}    ) THEN
{indent}        ALTER TABLE {table_name}
{indent}            ADD CONSTRAINT {constraint_name} 
{indent}            {constraint_def};
{indent}    END IF;
{indent}END $$;'''
    
    # Substituir todas as ocorrências
    new_content = re.sub(pattern, replace_func, content, flags=re.MULTILINE | re.IGNORECASE)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✅ Arquivo processado: {output_file}")

if __name__ == '__main__':
    input_file = 'database/smartchannel-db-v2-refactored-part7-foreign-keys.sql'
    output_file = 'database/smartchannel-db-v2-refactored-part7-foreign-keys.sql'
    process_file(input_file, output_file)
