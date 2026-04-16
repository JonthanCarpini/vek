#!/usr/bin/env bash
# Deploy completo na VPS Ubuntu 24.04
# Uso: bash install.sh
set -euo pipefail

DOMAIN="${DOMAIN:-espetinhodochef.site}"
EMAIL="${EMAIL:-admin@espetinhodochef.site}"
APP_DIR="${APP_DIR:-/opt/espetinhodochef}"
REPO_URL="${REPO_URL:-https://github.com/JonthanCarpini/vek.git}"

log() { echo ""; echo "==> $*"; }

log "1/9 Atualizando sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

log "2/9 Instalando pacotes base"
apt-get install -y ca-certificates curl gnupg git ufw nginx certbot python3-certbot-nginx openssl lsb-release

log "3/9 Instalando Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

log "4/9 Configurando UFW"
ufw allow 22/tcp   >/dev/null
ufw allow 80/tcp   >/dev/null
ufw allow 443/tcp  >/dev/null
yes | ufw enable   >/dev/null || true

log "5/9 Clonando/atualizando repositorio"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" reset --hard origin/main
fi
cd "$APP_DIR"

log "6/9 Gerando .env (se nao existir)"
if [ ! -f "$APP_DIR/.env" ]; then
  rand() { openssl rand -base64 "$1" | tr -d '\n=+/' | head -c "$2"; }
  MYSQL_ROOT=$(rand 32 28)
  MYSQL_PASS=$(rand 32 28)
  JWT=$(rand 64 60)
  JWTS=$(rand 64 60)
  ADMIN_PASS=$(rand 24 16)
  cat > "$APP_DIR/.env" <<EOF
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT}
MYSQL_DATABASE=mesa_digital
MYSQL_USER=mesa
MYSQL_PASSWORD=${MYSQL_PASS}
DATABASE_URL=mysql://mesa:${MYSQL_PASS}@mysql:3306/mesa_digital
JWT_SECRET=${JWT}
JWT_SESSION_SECRET=${JWTS}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_SOCKET_URL=https://${DOMAIN}
SEED_ADMIN_EMAIL=admin@${DOMAIN}
SEED_ADMIN_PASSWORD=${ADMIN_PASS}
EOF
  chmod 600 "$APP_DIR/.env"
  echo "${ADMIN_PASS}" > "$APP_DIR/.first-admin-password.txt"
  chmod 600 "$APP_DIR/.first-admin-password.txt"
  echo "Senha admin inicial salva em $APP_DIR/.first-admin-password.txt"
fi

log "7/9 Build + subida dos containers"
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

log "Aguardando MySQL ficar healthy..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml ps mysql | grep -q healthy; then
    echo "MySQL healthy."; break
  fi
  sleep 3
done

log "Rodando seed (idempotente)"
docker compose -f docker-compose.prod.yml exec -T app npm run seed || echo "(seed falhou ou ja executado)"

log "8/9 Nginx reverse proxy (HTTP inicial)"
cat > /etc/nginx/sites-available/${DOMAIN} <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name espetinhodochef.site www.espetinhodochef.site;
    client_max_body_size 10m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "9/9 Let's Encrypt SSL"
if certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect; then
  echo "SSL emitido com sucesso."
else
  echo "ATENCAO: Certbot falhou. DNS ainda pode estar propagando. Rode depois:"
  echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --agree-tos -m ${EMAIL} --redirect"
fi

echo ""
echo "============================================="
echo "Deploy concluido!"
echo "URL: https://${DOMAIN}"
echo "Admin: admin@${DOMAIN}"
if [ -f "$APP_DIR/.first-admin-password.txt" ]; then
  echo "Senha admin: $(cat $APP_DIR/.first-admin-password.txt)"
fi
echo "============================================="
