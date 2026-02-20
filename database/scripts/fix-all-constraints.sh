#!/bin/bash
# Script para tornar todas as constraints idempotentes
# Usa sed para substituir ALTER TABLE ... ADD CONSTRAINT por blocos DO

INPUT_FILE="database/smartchannel-db-v2-refactored-part7-foreign-keys.sql"
TEMP_FILE="/tmp/part7_fixed.sql"

# Criar backup
cp "$INPUT_FILE" "${INPUT_FILE}.backup"

# Processar arquivo linha por linha
python3 << 'PYTHON_SCRIPT'
import re
import sys

input_file = "database/smartchannel-db-v2-refactored-part7-foreign-keys.sql"
output_file = "/tmp/part7_fixed.sql"

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

output_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Verificar se é início de ALTER TABLE ... ADD CONSTRAINT
    if re.match(r'^\s*ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+(\w+)', line, re.IGNORECASE):
        # Coletar todas as linhas até o ponto e vírgula
        constraint_block = [line]
        i += 1
        
        while i < len(lines) and not lines[i].strip().rstrip(';').endswith(';'):
            constraint_block.append(lines[i])
            i += 1
        
        if i < len(lines):
            constraint_block.append(lines[i])
        
        full_block = ''.join(constraint_block)
        
        # Extrair informações
        match = re.search(
            r'ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+(\w+)\s+(.+)',
            full_block,
            re.IGNORECASE | re.DOTALL
        )
        
        if match:
            table_name = match.group(1)
            constraint_name = match.group(2)
            constraint_sql = match.group(3).rstrip(';').strip()
            
            # Verificar se já é um bloco DO (não substituir)
            if 'DO $$' in full_block or 'IF NOT EXISTS' in full_block:
                output_lines.extend(constraint_block)
            else:
                # Criar bloco DO
                new_block = f'''DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = '{constraint_name}'
        AND conrelid = '{table_name}'::regclass::oid
    ) THEN
        ALTER TABLE {table_name}
            ADD CONSTRAINT {constraint_name} 
            {constraint_sql};
    END IF;
END $$;
'''
                output_lines.append(new_block)
                output_lines.append('\n')
        else:
            output_lines.extend(constraint_block)
    else:
        output_lines.append(line)
    
    i += 1

with open(output_file, 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print(f"✅ Arquivo processado: {output_file}")
print(f"   Verifique o arquivo antes de substituir o original")

PYTHON_SCRIPT

if [ -f "$TEMP_FILE" ]; then
    echo "Arquivo processado salvo em: $TEMP_FILE"
    echo "Para aplicar, execute:"
    echo "  mv $TEMP_FILE $INPUT_FILE"
fi

