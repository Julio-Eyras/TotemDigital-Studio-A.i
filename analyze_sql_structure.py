#!/usr/bin/env python3
"""
Script para analisar e reorganizar o arquivo SQL smartchannel-db.sql
Identifica problemas de ordem e reorganiza: tabelas -> foreign keys -> índices
"""

import re
import sys
from collections import defaultdict

def analyze_sql_file(filepath):
    """Analisa o arquivo SQL e identifica problemas de ordem"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Estruturas para armazenar informações
    tables = {}  # {table_name: (line_num, definition_lines)}
    indexes = []  # [(line_num, table_name, index_line)]
    foreign_keys_inline = []  # Foreign keys dentro de CREATE TABLE
    foreign_keys_alter = []  # Foreign keys em ALTER TABLE
    
    current_table = None
    current_table_lines = []
    in_table_definition = False
    table_start_line = 0
    
    for i, line in enumerate(lines, 1):
        # Detectar início de tabela
        if re.match(r'^CREATE TABLE', line, re.IGNORECASE):
            match = re.search(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)', line, re.IGNORECASE)
            if match:
                current_table = match.group(1)
                table_start_line = i
                current_table_lines = [line]
                in_table_definition = True
                continue
        
        # Continuar coletando linhas da tabela
        if in_table_definition:
            current_table_lines.append(line)
            # Detectar fim de tabela
            if re.match(r'^\s*\);', line):
                tables[current_table] = (table_start_line, current_table_lines)
                in_table_definition = False
                current_table = None
                continue
            # Detectar foreign key inline
            if re.search(r'FOREIGN KEY.*REFERENCES', line, re.IGNORECASE):
                fk_match = re.search(r'REFERENCES\s+(\w+)', line, re.IGNORECASE)
                if fk_match:
                    foreign_keys_inline.append((i, current_table, fk_match.group(1), line.strip()))
            continue
        
        # Detectar índices
        if re.match(r'^CREATE INDEX', line, re.IGNORECASE):
            match = re.search(r'ON\s+(\w+)', line, re.IGNORECASE)
            if match:
                index_table = match.group(1)
                indexes.append((i, index_table, line.strip()))
        
        # Detectar ALTER TABLE para foreign keys
        if re.match(r'^ALTER TABLE', line, re.IGNORECASE):
            alt_match = re.search(r'ALTER TABLE\s+(\w+)', line, re.IGNORECASE)
            if alt_match:
                # Próxima linha deve ter ADD CONSTRAINT ou ADD FOREIGN KEY
                if i < len(lines) and re.search(r'ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN KEY', lines[i], re.IGNORECASE):
                    fk_match = re.search(r'REFERENCES\s+(\w+)', lines[i], re.IGNORECASE)
                    if fk_match:
                        foreign_keys_alter.append((i, alt_match.group(1), fk_match.group(1)))
    
    # Verificar problemas: índices criados antes das tabelas
    problems = []
    for idx_line, table_name, index_line in indexes:
        if table_name in tables:
            table_line = tables[table_name][0]
            if idx_line < table_line:
                problems.append({
                    'type': 'index_before_table',
                    'line': idx_line,
                    'table': table_name,
                    'table_line': table_line,
                    'index_line': index_line[:100]
                })
    
    return {
        'tables': tables,
        'indexes': indexes,
        'foreign_keys_inline': foreign_keys_inline,
        'foreign_keys_alter': foreign_keys_alter,
        'problems': problems,
        'total_lines': len(lines)
    }

def print_analysis(results):
    """Imprime análise dos resultados"""
    print("=" * 80)
    print("ANALISE DO ARQUIVO SQL")
    print("=" * 80)
    print(f"\nTotal de tabelas: {len(results['tables'])}")
    print(f"Total de índices: {len(results['indexes'])}")
    print(f"Foreign keys inline: {len(results['foreign_keys_inline'])}")
    print(f"Foreign keys ALTER TABLE: {len(results['foreign_keys_alter'])}")
    
    print("\n" + "=" * 80)
    print("PROBLEMAS ENCONTRADOS")
    print("=" * 80)
    
    if results['problems']:
        print(f"\n[ERRO] {len(results['problems'])} problemas encontrados:\n")
        for problem in results['problems']:
            print(f"Linha {problem['line']}: Indice para '{problem['table']}' criado ANTES da tabela")
            print(f"  Tabela esta na linha: {problem['table_line']}")
            print(f"  Indice: {problem['index_line']}")
            print()
    else:
        print("\n[OK] Nenhum problema encontrado!")
    
    # Listar todas as tabelas e suas dependências
    print("\n" + "=" * 80)
    print("TABELAS E DEPENDÊNCIAS")
    print("=" * 80)
    
    # Criar mapa de dependências
    dependencies = defaultdict(set)
    for _, table, ref_table, _ in results['foreign_keys_inline']:
        dependencies[table].add(ref_table)
    for _, table, ref_table in results['foreign_keys_alter']:
        dependencies[table].add(ref_table)
    
    # Ordenar tabelas por dependências (topological sort simples)
    sorted_tables = []
    remaining = set(results['tables'].keys())
    
    while remaining:
        # Encontrar tabelas sem dependências não resolvidas
        ready = [t for t in remaining if not dependencies[t] or all(dep in sorted_tables for dep in dependencies[t])]
        if not ready:
            # Ciclo detectado ou dependência circular
            ready = [list(remaining)[0]]
        for table in sorted(ready):
            sorted_tables.append(table)
            remaining.remove(table)
    
    print(f"\nOrdem sugerida de criação (considerando dependências):\n")
    for i, table in enumerate(sorted_tables, 1):
        deps = dependencies.get(table, set())
        if deps:
            print(f"{i:3}. {table:30} (depende de: {', '.join(sorted(deps))})")
        else:
            print(f"{i:3}. {table:30} (sem dependências)")

if __name__ == '__main__':
    filepath = 'database/smartchannel-db.sql'
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    
    try:
        results = analyze_sql_file(filepath)
        print_analysis(results)
    except FileNotFoundError:
        print(f"Erro: Arquivo não encontrado: {filepath}")
        sys.exit(1)
    except Exception as e:
        print(f"Erro ao analisar arquivo: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

