#!/usr/bin/env python3
"""
Script para tornar todas as constraints idempotentes no part7-foreign-keys.sql
"""

import re
import sys
from pathlib import Path

def fix_constraints(input_file, output_file):
    """Processa o arquivo e torna todas as constraints idempotentes"""
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    output_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Verificar se é início de ALTER TABLE ... ADD CONSTRAINT
        match = re.match(r'^\s*ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+(\w+)', line, re.IGNORECASE)
        
        if match and 'DO $$' not in line and 'IF NOT EXISTS' not in line:
            table_name = match.group(1)
            constraint_name = match.group(2)
            
            # Coletar todas as linhas até o ponto e vírgula
            constraint_lines = [line]
            i += 1
            
            while i < len(lines) and not lines[i].strip().endswith(';'):
                constraint_lines.append(lines[i])
                i += 1
            
            if i < len(lines):
                constraint_lines.append(lines[i])
            
            full_block = '\n'.join(constraint_lines)
            
            # Extrair a parte do FOREIGN KEY
            fk_match = re.search(
                r'FOREIGN KEY\s+\([^)]+\)\s+REFERENCES\s+\w+\([^)]+\)\s+(ON DELETE\s+\w+)?',
                full_block,
                re.IGNORECASE | re.DOTALL
            )
            
            if fk_match:
                fk_part = fk_match.group(0)
                
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
            {fk_part};
    END IF;
END $$;'''
                
                output_lines.append(new_block)
                output_lines.append('')
            else:
                # Se não conseguir extrair, manter original
                output_lines.extend(constraint_lines)
        else:
            output_lines.append(line)
        
        i += 1
    
    new_content = '\n'.join(output_lines)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return output_file

if __name__ == '__main__':
    script_dir = Path(__file__).parent.parent
    input_file = script_dir / 'smartchannel-db-v2-refactored-part7-foreign-keys.sql'
    output_file = script_dir / 'smartchannel-db-v2-refactored-part7-foreign-keys.sql.new'
    
    if not input_file.exists():
        print(f"❌ Arquivo não encontrado: {input_file}", file=sys.stderr)
        sys.exit(1)
    
    try:
        result = fix_constraints(str(input_file), str(output_file))
        print(f"✅ Arquivo processado: {result}")
        print(f"   Verifique o arquivo e depois substitua o original:")
        print(f"   mv {output_file} {input_file}")
    except Exception as e:
        print(f"❌ Erro: {e}", file=sys.stderr)
        sys.exit(1)

