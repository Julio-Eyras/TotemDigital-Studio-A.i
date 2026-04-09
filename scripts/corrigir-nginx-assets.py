#!/usr/bin/env python3
"""
Script para corrigir configuração do Nginx
Substitui 'alias' por 'proxy_pass' em blocos location /assets/
Execute com: sudo python3 scripts/corrigir-nginx-assets.py
"""

import re
import sys
import shutil
from datetime import datetime

NGINX_CONFIG = "/etc/nginx/sites-available/smart-signage"

def main():
    try:
        # Ler arquivo
        with open(NGINX_CONFIG, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Padrão para encontrar blocos location /assets/ com alias
        # Captura desde "location /assets/" até o fechamento "}"
        pattern = r'(location\s+/assets/\s*\{[^\}]*?)alias\s+/opt/smart-signage/public/assets/;([^\}]*?)(\})'
        
        def replace_match(match):
            before = match.group(1)
            after = match.group(2)
            closing = match.group(3)
            
            # Remover linhas expires e add_header se existirem (vamos adicionar depois)
            after = re.sub(r'\s*expires\s+[^;]+;', '', after)
            after = re.sub(r'\s*add_header\s+Cache-Control\s+[^;]+;', '', after)
            
            # Construir novo bloco com proxy_pass
            new_block = f'''{before}proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";{after}{closing}'''
            
            return new_block
        
        # Aplicar substituição
        new_content = re.sub(pattern, replace_match, content, flags=re.DOTALL | re.MULTILINE)
        
        # Verificar se houve mudanças
        if new_content == original_content:
            print("ℹ️  Nenhuma alteração necessária")
            print("   (já está usando proxy_pass ou formato diferente)")
            return 0
        
        # Contar quantos blocos foram alterados
        matches = len(re.findall(pattern, original_content, flags=re.DOTALL | re.MULTILINE))
        
        # Criar backup
        backup_file = f"{NGINX_CONFIG}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy(NGINX_CONFIG, backup_file)
        print(f"✅ Backup criado: {backup_file}")
        
        # Escrever novo conteúdo
        with open(NGINX_CONFIG, 'w') as f:
            f.write(new_content)
        
        print(f"✅ Configuração atualizada!")
        print(f"   {matches} bloco(s) location /assets/ alterado(s)")
        print("")
        print("📋 Próximos passos:")
        print("   1. Testar configuração: sudo nginx -t")
        print("   2. Recarregar Nginx: sudo systemctl reload nginx")
        
        return 0
        
    except PermissionError:
        print("❌ Erro: Permissão negada")
        print("   Execute com sudo: sudo python3 scripts/corrigir-nginx-assets.py")
        return 1
    except FileNotFoundError:
        print(f"❌ Erro: Arquivo não encontrado: {NGINX_CONFIG}")
        return 1
    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
