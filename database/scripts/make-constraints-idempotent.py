#!/usr/bin/env python3
"""
Script para tornar todas as constraints idempotentes no part7-foreign-keys.sql
Adiciona verificação IF NOT EXISTS para todas as constraints
"""

import re
import sys

def make_constraint_idempotent(content):
    """Converte ALTER TABLE ... ADD CONSTRAINT para formato idempotente"""
    
    # Padrão para encontrar ALTER TABLE ... ADD CONSTRAINT
    pattern = r'ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+(\w+)\s+(FOREIGN KEY[^;]+);'
    
    def replace_constraint(match):
        table_name = match.group(1)
        constraint_name = match.group(2)
        constraint_sql = match.group(3)
        
        # Criar bloco DO com verificação
        return f'''DO $$ 
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
END $$;'''
    
    # Substituir todas as ocorrências
    new_content = re.sub(pattern, replace_constraint, content, flags=re.IGNORECASE | re.MULTILINE | re.DOTALL)
    
    return new_content

if __name__ == '__main__':
    input_file = 'database/smartchannel-db-v2-refactored-part7-foreign-keys.sql'
    output_file = 'database/smartchannel-db-v2-refactored-part7-foreign-keys.sql'
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Manter a primeira constraint que já está correta
        # Aplicar transformação apenas nas outras
        lines = content.split('\n')
        new_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Se encontrar ALTER TABLE ... ADD CONSTRAINT (exceto a primeira que já tem DO)
            if re.match(r'^\s*ALTER TABLE\s+\w+\s+ADD CONSTRAINT\s+\w+', line, re.IGNORECASE):
                # Coletar todas as linhas até o ponto e vírgula
                constraint_lines = [line]
                i += 1
                while i < len(lines) and not lines[i].strip().endswith(';'):
                    constraint_lines.append(lines[i])
                    i += 1
                if i < len(lines):
                    constraint_lines.append(lines[i])
                
                constraint_block = '\n'.join(constraint_lines)
                
                # Extrair informações
                match = re.search(r'ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+(\w+)\s+(.+)', constraint_block, re.IGNORECASE | re.DOTALL)
                if match:
                    table_name = match.group(1)
                    constraint_name = match.group(2)
                    constraint_sql = match.group(3).rstrip(';').strip()
                    
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
END $$;'''
                    new_lines.append(new_block)
                    new_lines.append('')
                else:
                    new_lines.extend(constraint_lines)
            else:
                new_lines.append(line)
            
            i += 1
        
        new_content = '\n'.join(new_lines)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ Arquivo atualizado: {output_file}")
        print(f"   Todas as constraints agora são idempotentes")
        
    except Exception as e:
        print(f"❌ Erro: {e}", file=sys.stderr)
        sys.exit(1)


