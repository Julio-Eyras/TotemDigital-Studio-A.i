#!/usr/bin/env python3
"""
Script para reorganizar o arquivo SQL smartchannel-db.sql
Ordem: 1) Tabelas (respeitando dependências) 2) Foreign Keys (ALTER TABLE) 3) Índices
"""

import re
import sys
from collections import defaultdict, deque

def parse_sql_file(filepath):
    """Parseia o arquivo SQL e extrai todas as seções"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Estruturas
    header = []  # Linhas antes da primeira tabela
    tables = {}  # {table_name: (start_line, end_line, definition)}
    indexes = []  # [(line_num, table_name, index_definition)]
    foreign_keys_alter = []  # ALTER TABLE para foreign keys
    comments_after_tables = []  # Comentários e outras coisas após tabelas
    footer = []  # Linhas finais (views, functions, etc.)
    
    current_table = None
    current_table_start = 0
    current_table_lines = []
    in_table_definition = False
    in_header = True
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Header (até primeira tabela)
        if in_header and not re.match(r'^CREATE TABLE', line, re.IGNORECASE):
            header.append(line)
            i += 1
            continue
        else:
            in_header = False
        
        # CREATE TABLE
        if re.match(r'^CREATE TABLE', line, re.IGNORECASE):
            match = re.search(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)', line, re.IGNORECASE)
            if match:
                current_table = match.group(1)
                current_table_start = i
                current_table_lines = [line]
                in_table_definition = True
                i += 1
                continue
        
        # Dentro da definição de tabela
        if in_table_definition:
            current_table_lines.append(line)
            # Fim da tabela
            if re.match(r'^\s*\);', line):
                tables[current_table] = (current_table_start, i, current_table_lines)
                in_table_definition = False
                current_table = None
                i += 1
                continue
            i += 1
            continue
        
        # CREATE INDEX
        if re.match(r'^CREATE INDEX', line, re.IGNORECASE):
            match = re.search(r'ON\s+(\w+)', line, re.IGNORECASE)
            if match:
                index_table = match.group(1)
                # Coletar linhas do índice (pode ser multi-linha)
                index_lines = [line]
                j = i + 1
                while j < len(lines) and not re.match(r'^(CREATE|ALTER|COMMENT|--|$)', lines[j], re.IGNORECASE):
                    index_lines.append(lines[j])
                    j += 1
                indexes.append((i, index_table, '\n'.join(index_lines)))
                i = j
                continue
        
        # ALTER TABLE (foreign keys)
        if re.match(r'^ALTER TABLE', line, re.IGNORECASE):
            # Coletar linhas do ALTER TABLE
            alter_lines = [line]
            j = i + 1
            while j < len(lines) and not re.match(r'^(CREATE|ALTER|COMMENT|--|$)', lines[j], re.IGNORECASE):
                alter_lines.append(lines[j])
                j += 1
            foreign_keys_alter.append((i, '\n'.join(alter_lines)))
            i = j
            continue
        
        # Outras coisas (COMMENT, CREATE VIEW, CREATE FUNCTION, etc.)
        if re.match(r'^(COMMENT|CREATE VIEW|CREATE FUNCTION|DO|GRANT|REVOKE|INSERT)', line, re.IGNORECASE):
            # Coletar bloco completo
            other_lines = [line]
            j = i + 1
            # Continuar até próximo CREATE ou fim do arquivo
            while j < len(lines):
                next_line = lines[j]
                if re.match(r'^(CREATE|ALTER|COMMENT|--|$)', next_line, re.IGNORECASE) and j > i + 1:
                    break
                other_lines.append(next_line)
                j += 1
            comments_after_tables.append((i, '\n'.join(other_lines)))
            i = j
            continue
        
        # Linhas vazias ou comentários soltos
        if not line.strip() or line.strip().startswith('--'):
            comments_after_tables.append((i, line))
            i += 1
            continue
        
        # Linha não categorizada
        comments_after_tables.append((i, line))
        i += 1
    
    return {
        'header': header,
        'tables': tables,
        'indexes': indexes,
        'foreign_keys_alter': foreign_keys_alter,
        'comments_after_tables': comments_after_tables
    }

def get_table_dependencies(tables):
    """Extrai dependências das tabelas baseado em FOREIGN KEY"""
    dependencies = defaultdict(set)
    
    for table_name, (_, _, definition) in tables.items():
        definition_text = '\n'.join(definition)
        # Procurar FOREIGN KEY ... REFERENCES
        fk_matches = re.finditer(r'FOREIGN KEY.*?REFERENCES\s+(\w+)', definition_text, re.IGNORECASE)
        for match in fk_matches:
            ref_table = match.group(1)
            if ref_table in tables:
                dependencies[table_name].add(ref_table)
    
    return dependencies

def topological_sort(tables, dependencies):
    """Ordena tabelas respeitando dependências (topological sort)"""
    # Calcular graus de entrada
    in_degree = {table: 0 for table in tables}
    for table, deps in dependencies.items():
        for dep in deps:
            if dep in in_degree:
                in_degree[table] += 1
    
    # Ordenação topológica
    queue = deque([table for table, degree in in_degree.items() if degree == 0])
    sorted_tables = []
    
    while queue:
        table = queue.popleft()
        sorted_tables.append(table)
        
        # Reduzir grau de tabelas que dependem desta
        for other_table, deps in dependencies.items():
            if table in deps:
                in_degree[other_table] -= 1
                if in_degree[other_table] == 0:
                    queue.append(other_table)
    
    # Adicionar tabelas que não foram ordenadas (ciclos ou tabelas sem dependências detectadas)
    remaining = set(tables.keys()) - set(sorted_tables)
    if remaining:
        sorted_tables.extend(sorted(remaining))
    
    return sorted_tables

def reorganize_sql(parsed_data):
    """Reorganiza o SQL na ordem correta"""
    output = []
    
    # 1. Header
    output.extend(parsed_data['header'])
    output.append('')
    output.append('-- =============================================')
    output.append('-- TABELAS (em ordem de dependências)')
    output.append('-- =============================================')
    output.append('')
    
    # 2. Ordenar tabelas por dependências
    dependencies = get_table_dependencies(parsed_data['tables'])
    sorted_tables = topological_sort(parsed_data['tables'], dependencies)
    
    # 3. Criar todas as tabelas (sem FOREIGN KEYs inline por enquanto)
    # Na verdade, vamos manter FOREIGN KEYs inline, mas garantir ordem correta
    for table_name in sorted_tables:
        table_def = parsed_data['tables'][table_name][2]
        output.extend(table_def)
        output.append('')
    
    # 4. Foreign Keys em ALTER TABLE (se houver)
    if parsed_data['foreign_keys_alter']:
        output.append('')
        output.append('-- =============================================')
        output.append('-- FOREIGN KEYS (ALTER TABLE)')
        output.append('-- =============================================')
        output.append('')
        for _, alter_def in parsed_data['foreign_keys_alter']:
            output.append(alter_def)
            output.append('')
    
    # 5. Índices (agrupados por tabela)
    output.append('')
    output.append('-- =============================================')
    output.append('-- ÍNDICES (agrupados por tabela)')
    output.append('-- =============================================')
    output.append('')
    
    # Agrupar índices por tabela
    indexes_by_table = defaultdict(list)
    for _, table_name, index_def in parsed_data['indexes']:
        indexes_by_table[table_name].append(index_def)
    
    # Criar índices na mesma ordem das tabelas
    for table_name in sorted_tables:
        if table_name in indexes_by_table:
            output.append(f'-- Índices para {table_name}')
            for index_def in indexes_by_table[table_name]:
                output.append(index_def)
            output.append('')
    
    # Índices de tabelas que não estão na lista ordenada
    for table_name in sorted(indexes_by_table.keys()):
        if table_name not in sorted_tables:
            output.append(f'-- Índices para {table_name}')
            for index_def in indexes_by_table[table_name]:
                output.append(index_def)
            output.append('')
    
    # 6. Comentários e outras coisas (views, functions, etc.)
    if parsed_data['comments_after_tables']:
        output.append('')
        output.append('-- =============================================')
        output.append('-- COMENTÁRIOS, VIEWS, FUNCTIONS, ETC.')
        output.append('-- =============================================')
        output.append('')
        for _, comment_def in parsed_data['comments_after_tables']:
            output.append(comment_def)
    
    return '\n'.join(output)

if __name__ == '__main__':
    input_file = 'database/smartchannel-db.sql'
    output_file = 'database/smartchannel-db.sql.reorganized'
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    try:
        print(f"Analisando {input_file}...")
        parsed = parse_sql_file(input_file)
        
        print(f"Encontradas {len(parsed['tables'])} tabelas")
        print(f"Encontrados {len(parsed['indexes'])} indices")
        print(f"Encontrados {len(parsed['foreign_keys_alter'])} ALTER TABLE para foreign keys")
        
        print("\nReorganizando...")
        reorganized = reorganize_sql(parsed)
        
        print(f"Salvando em {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(reorganized)
        
        print(f"\n[OK] Arquivo reorganizado salvo em: {output_file}")
        print("Revise o arquivo antes de substituir o original!")
        
    except Exception as e:
        print(f"Erro: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

