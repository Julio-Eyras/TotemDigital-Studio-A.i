#!/usr/bin/env python3
"""
Script para reorganizar smartchannel-db.sql em ordem correta de dependências
"""

import re
from collections import defaultdict, deque

# Mapeamento de dependências (tabela -> [tabelas que dependem dela])
dependencies = {
    # Tabelas base (sem dependências)
    'clients': [],
    'hosts': [],
    'ai_models': [],
    'system_logs': [],
    'webhook_configs': [],
    'alert_rules': [],
    'ml_models': [],
    'roles': [],
    'permissions': [],
    'system_settings': [],
    'plans': [],
    'fx_effects': [],
    'fx_rules': [],
    'fx_timelines': [],
    'webhooks': [],
    
    # Nível 1
    'users': ['clients'],
    'stripe_customers': ['clients'],
    'locals': ['hosts'],
    'subscriptions': ['clients', 'plans'],
    'role_permissions': ['roles', 'permissions'],
    'webhook_deliveries': ['webhook_configs'],
    'alert_logs': ['alert_rules'],
    
    # Nível 2
    'export_queries': ['users'],
    'export_schedules': ['export_queries', 'users'],
    'export_executions': ['export_schedules', 'export_queries'],
    'campaigns': ['clients'],
    'fx_sites': ['clients'],
    'password_reset_tokens': ['users'],
    'medias': ['clients', 'users'],
    'user_roles': ['users', 'roles'],
    'audit_logs': ['users'],
    'advanced_schedules': ['users'],
    'reports': ['users'],
    'report_templates': ['users'],
    'user_two_factor': ['users'],
    'two_factor_attempts': ['users'],
    'ota_updates': ['users'],
    'dashboard_layouts': ['users'],
    'backups': ['users'],
    
    # Nível 3
    'totems': ['locals', 'clients'],
    'playlists': ['totems', 'campaigns', 'clients'],
    'smart_playlists': ['clients', 'campaigns', 'totems'],
    'campaign_totems': ['totems', 'campaigns'],
    'qr_codes': ['clients', 'totems', 'campaigns'],
    'short_links': ['campaigns', 'totems'],
    'remote_commands': ['totems', 'users'],
    'billing': ['clients', 'campaigns', 'totems', 'subscriptions'],
    'analytics_sessions': ['totems'],
    'execution_logs': ['totems', 'clients', 'campaigns', 'medias'],
    'emotion_data': ['totems'],
    'gesture_data': ['totems'],
    'behavior_data': ['totems'],
    'totem_ml_config': ['totems'],
    'ml_sessions': ['totems', 'campaigns', 'medias'],
    'aggregated_metrics': ['totems', 'campaigns', 'medias'],
    'device_certificates': ['totems'],
    'totem_update_status': ['totems', 'ota_updates'],
    'interaction_logs': ['totems', 'medias'],
    'totem_network': ['totems'],
    'fx_telemetry': ['totems'],
    'fx_totem_sites': ['totems', 'fx_sites'],
    'playlist_items': ['playlists', 'medias'],
    'campaign_playlists': ['campaigns', 'playlists'],
    'event_logs': ['totems', 'campaigns', 'playlists', 'medias'],
    'analytics_qr_scans': ['qr_codes', 'totems'],
    'remote_screenshots': ['totems', 'remote_commands'],
    'payments': ['billing'],
    'analytics_emotions': ['analytics_sessions'],
    'analytics_gestures': ['analytics_sessions'],
    'smart_tvs': [],
    'schedule_executions': ['advanced_schedules'],
    'tags': ['medias'],
    'recognized_persons': ['medias'],
    'approval_workflows': ['medias', 'users'],
}

def topological_sort(tables):
    """Ordena tabelas por dependências usando topological sort"""
    in_degree = defaultdict(int)
    graph = defaultdict(list)
    
    # Construir grafo
    for table in tables:
        if table in dependencies:
            deps = dependencies[table]
            in_degree[table] = len(deps)
            for dep in deps:
                if dep in tables:
                    graph[dep].append(table)
    
    # Topological sort
    queue = deque([t for t in tables if in_degree[t] == 0])
    result = []
    
    while queue:
        node = queue.popleft()
        result.append(node)
        
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
    
    # Adicionar tabelas sem dependências conhecidas
    for table in tables:
        if table not in result:
            result.append(table)
    
    return result

if __name__ == '__main__':
    print("Script de reorganização criado.")
    print("Ordem sugerida de criação:")
    
    all_tables = list(dependencies.keys())
    ordered = topological_sort(all_tables)
    
    for i, table in enumerate(ordered, 1):
        deps = dependencies.get(table, [])
        if deps:
            print(f"{i:2d}. {table:30s} (depende de: {', '.join(deps)})")
        else:
            print(f"{i:2d}. {table:30s} (BASE)")

