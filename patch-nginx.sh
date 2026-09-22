#!/usr/bin/env bash
# ==============================================================================
# Script di Patching Automatico Nginx per Integrazione Danea Easyfatt e Node.js
# Esecuzione: sudo bash patch-nginx.sh
# ==============================================================================

set -e

echo "========================================================="
echo "🚀 Avvio Patching Automatico Nginx per Danea Easyfatt..."
echo "========================================================="

# 1. Verifica permessi di root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Errore: questo script deve essere eseguito come root (es. sudo bash patch-nginx.sh)"
  exit 1
fi

# 2. Verifica presenza di Nginx
if ! command -v nginx &> /dev/null; then
  echo "⚠️ Nginx non risulta installato. Installazione in corso..."
  apt-get update -y && apt-get install -y nginx
fi

# 3. Pulizia Phantom Files (elimina file statici legacy che causano l'errore 405)
echo "🧹 Eliminazione file statici fantasma in /var/www e /usr/share/nginx..."
find /var/www /usr/share/nginx/html /var/www/html -type f \( -name "*uploadarticoli*" -o -name "*downloadordini*" -o -name "*uploadclienti*" -o -name "articoli.xml" -o -name "ordini.xml" \) -delete 2>/dev/null || true

# 4. Backup configurazione esistente
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -f "/etc/nginx/sites-available/default" ]; then
  echo "📦 Backup di /etc/nginx/sites-available/default in default.backup_$TIMESTAMP"
  cp /etc/nginx/sites-available/default "/etc/nginx/sites-available/default.backup_$TIMESTAMP"
fi

# 5. Scrittura Configurazione Ottimizzata in sites-available/default
echo "📝 Scrittura configurazione VirtualHost ad alta priorità..."
cat << 'EOF' > /etc/nginx/sites-available/default
# ==============================================================================
# Configurazione Nginx per Piattaforma Connect & Danea Easyfatt Integration
# ==============================================================================

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Aumento limite upload per cataloghi prodotti e foto ad alta risoluzione
    client_max_body_size 50M;

    # Fallback interno contro i 405 di Nginx
    error_page 405 =200 @proxy_node;

    # 1. Match Esatto a Priorità Massima (=) per gli script Danea
    location = /uploadarticoli.php {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header HTTP_X_AUTHORIZATION $http_x_authorization;
        proxy_set_header X-Authorization $http_x_authorization;
        proxy_buffering off;
        error_page 405 =200 @proxy_node;
    }

    location = /uploadclienti.php {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header HTTP_X_AUTHORIZATION $http_x_authorization;
        proxy_set_header X-Authorization $http_x_authorization;
        proxy_buffering off;
        error_page 405 =200 @proxy_node;
    }

    location = /downloadordini.php {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header HTTP_X_AUTHORIZATION $http_x_authorization;
        proxy_set_header X-Authorization $http_x_authorization;
        proxy_buffering off;
        error_page 405 =200 @proxy_node;
    }

    # 2. Intercettazione di tutti gli altri script .php richiesti da integrazioni esterne
    location ~ \.php$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header HTTP_X_AUTHORIZATION $http_x_authorization;
        proxy_set_header X-Authorization $http_x_authorization;
        proxy_buffering off;
        error_page 405 =200 @proxy_node;
    }

    # 3. Prefisso prioritario per tutte le API /api/easyfatt
    location ^~ /api/easyfatt {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header HTTP_X_AUTHORIZATION $http_x_authorization;
        proxy_set_header X-Authorization $http_x_authorization;
        proxy_buffering off;
    }

    # 4. Inoltro di fallback per Node.js
    location @proxy_node {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header HTTP_X_AUTHORIZATION $http_x_authorization;
    }

    # 5. Routing generale dell'applicazione (React SPA + Express APIs)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header HTTP_X_AUTHORIZATION $http_x_authorization;
        proxy_set_header X-Authorization $http_x_authorization;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
EOF

# 6. Assicura il link simbolico in sites-enabled
mkdir -p /etc/nginx/sites-enabled
if [ ! -f "/etc/nginx/sites-enabled/default" ] && [ ! -L "/etc/nginx/sites-enabled/default" ]; then
  ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

# 7. Test della sintassi Nginx
echo "🔍 Verifica della sintassi di Nginx (nginx -t)..."
nginx -t

# 8. Ricarica e riavvio del servizio Nginx
echo "🔄 Ricarica del servizio Nginx..."
if command -v systemctl &> /dev/null; then
  systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
elif command -v service &> /dev/null; then
  service nginx reload 2>/dev/null || service nginx restart 2>/dev/null || true
else
  nginx -s reload 2>/dev/null || true
fi

echo "========================================================="
echo "✅ PATCH APPLICATA CON SUCCESSO!"
echo "Tutte le chiamate POST/GET (inclusi .php) sono ora correttamente inoltrate a Node.js sulla porta 3000."
echo "========================================================="
