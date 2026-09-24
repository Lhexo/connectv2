#!/usr/bin/env bash
set -e

echo "=== Configurazione Nginx per Danea Easyfatt (Porta 3000) ==="

# Verifica permessi root
if [ "$EUID" -ne 0 ]; then
  echo "Errore: esegui questo script come root o con sudo."
  exit 1
fi

TARGET_CONF="/etc/nginx/sites-available/default"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CONF="$SCRIPT_DIR/nginx-danea.conf"

echo "[1/5] Eliminazione file statici fantasma (Phantom Files)..."
find /var/www /usr/share/nginx/html /var/www/html -type f \( -name "*uploadarticoli*" -o -name "*downloadordini*" -o -name "*uploadclienti*" -o -name "articoli.xml" -o -name "ordini.xml" -o -name "clienti.xml" \) -delete 2>/dev/null || true

echo "[2/5] Copia della configurazione in $TARGET_CONF..."
cp "$SOURCE_CONF" "$TARGET_CONF"

echo "[3/5] Verifica link simbolico in sites-enabled..."
mkdir -p /etc/nginx/sites-enabled
if [ ! -L /etc/nginx/sites-enabled/default ]; then
  ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

echo "[4/5] Validazione sintassi Nginx..."
nginx -t

echo "[5/5] Riavvio servizio Nginx..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart nginx
elif command -v service >/dev/null 2>&1; then
  service nginx restart
else
  nginx -s reload
fi

echo "=== Nginx configurato con successo! ==="
echo "Verifica con:"
echo "curl -i -X POST http://127.0.0.1/uploadarticoli.php"
