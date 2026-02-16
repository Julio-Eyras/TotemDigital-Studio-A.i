# 🔧 Correção Urgente: Erro 404 em Assets

## Problema
Arquivos de mídia retornam 404 porque o Nginx não tem permissão para ler os arquivos diretamente.

## Solução Rápida

Execute **UM** dos comandos abaixo:

### Opção 1: Script Automatizado (Recomendado)
```bash
sudo /home/smartchannel/SmartSignage-Pro/scripts/fix-nginx-assets-now.sh
```

### Opção 2: Ajustar Permissões
```bash
sudo chown -R www-data:www-data /opt/smart-signage/public/assets
sudo find /opt/smart-signage/public/assets -type d -exec chmod 755 {} \;
sudo find /opt/smart-signage/public/assets -type f -exec chmod 644 {} \;
sudo systemctl reload nginx
```

### Opção 3: Script Python Direto
```bash
sudo python3 /tmp/fix_nginx_assets.py
sudo nginx -t && sudo systemctl reload nginx
```

---

## O que o script faz?

1. ✅ Cria backup da configuração do Nginx
2. ✅ Substitui `alias` por `proxy_pass` para o backend
3. ✅ Testa a configuração
4. ✅ Recarrega o Nginx automaticamente

---

## Verificação

Após executar, teste:
```bash
curl -I http://192.168.1.110/assets/uploads/subscriber-1/medias/Cestto_00005.png
```

Deve retornar: `HTTP/1.1 200 OK`
