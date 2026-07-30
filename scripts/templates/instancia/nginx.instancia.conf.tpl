# TotemDigital — instância @@TDI_ID@@ (@@TDI_DOMAIN@@)
# Gerado por Instala-TotemDigital-Server.sh
# sites-available/@@TDI_NGINX_SITE@@

map $host $smssi_sd_type_@@TDI_ID@@ {
    default main;
    publisher.@@TDI_DOMAIN@@ publisher;
    subscriber.@@TDI_DOMAIN@@ subscriber;
}

# HTTP — ACME + redireccionamento HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name @@TDI_DOMAIN@@;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS — painel React + API + player
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name @@TDI_DOMAIN@@;

    ssl_certificate /etc/letsencrypt/live/@@TDI_DOMAIN@@/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/@@TDI_DOMAIN@@/privkey.pem;
@@TDI_SSL_EXTRA@@
    ssl_protocols TLSv1.2 TLSv1.3;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    client_max_body_size 500M;
    client_body_buffer_size 512k;

    root @@TDI_OPT_ROOT@@/frontend/build;
    index index.html;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:@@TDI_BACKEND_PORT@@;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Subdomain-Type $smssi_sd_type_@@TDI_ID@@;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location ^~ /assets/ {
        alias @@TDI_OPT_ROOT@@/public/assets/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location ^~ /player {
        proxy_pass http://127.0.0.1:@@TDI_BACKEND_PORT@@;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Painel HTTP auxiliar (LAN / IP) — porta @@TDI_HTTP_PORT@@
server {
    listen @@TDI_HTTP_PORT@@;
    listen [::]:@@TDI_HTTP_PORT@@;
    server_name @@TDI_DOMAIN@@ _;

    client_max_body_size 500M;

    root @@TDI_OPT_ROOT@@/frontend/build;
    index index.html;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:@@TDI_BACKEND_PORT@@;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Subdomain-Type $smssi_sd_type_@@TDI_ID@@;
    }

    location ^~ /assets/ {
        alias @@TDI_OPT_ROOT@@/public/assets/;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
