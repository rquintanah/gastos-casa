#!/usr/bin/env bash
# Despliegue MANUAL (lo ejecuta el humano, nunca el agente).
# Modelo: un servidor (VPS) con Docker; el repo clonado allí; docker compose reconstruye y reinicia.
#
# Uso:  bash scripts/desplegar.sh            -> despliega la rama main
#       bash scripts/desplegar.sh v1.2.0     -> despliega una etiqueta concreta
#
# Configura una vez (en tu ~/.bashrc de WSL o en un archivo .deploy.env no versionado):
#   DEPLOY_HOST=usuario@ip-del-servidor
#   DEPLOY_DIR=/opt/<proyecto>
set -euo pipefail

[ -f .deploy.env ] && . ./.deploy.env
: "${DEPLOY_HOST:?Define DEPLOY_HOST (usuario@servidor) en .deploy.env}"
: "${DEPLOY_DIR:?Define DEPLOY_DIR (carpeta del proyecto en el servidor) en .deploy.env}"
VERSION="${1:-main}"

echo "==> Verificación local antes de desplegar"
git fetch --tags --quiet
[ -z "$(git status --porcelain)" ] || { echo "Tienes cambios sin commitear. Aborto."; exit 1; }
if command -v gh >/dev/null; then
  estado=$(gh run list --branch main --workflow ci --limit 1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || echo "")
  [ "$estado" = "success" ] || { echo "El último CI de main no está en verde ($estado). Aborto."; exit 1; }
fi

read -r -p "Desplegar '$VERSION' en $DEPLOY_HOST:$DEPLOY_DIR ? (escribe 'si') " ok
[ "$ok" = "si" ] || { echo "Cancelado."; exit 0; }

echo "==> Desplegando"
ssh "$DEPLOY_HOST" bash -s <<EOF
set -euo pipefail
cd "$DEPLOY_DIR"
git fetch --all --tags --quiet
git checkout --quiet "$VERSION"
git pull --quiet --ff-only 2>/dev/null || true
docker compose pull --quiet || true
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
EOF

echo "==> Listo. Revisa los logs con: ssh $DEPLOY_HOST 'cd $DEPLOY_DIR && docker compose logs --tail=100'"
