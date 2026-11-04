#!/usr/bin/env bash
# Crea una carpeta de trabajo aislada (git worktree) para que un agente trabaje en paralelo sin pisar a otro.
# Uso: bash scripts/nuevo-worktree.sh <slug> [prefijo-rama]   ej: bash scripts/nuevo-worktree.sh login-google feat
set -euo pipefail

SLUG="${1:?Uso: nuevo-worktree.sh <slug> [feat|fix|refactor]}"
PREFIJO="${2:-feat}"
RAIZ=$(git rev-parse --show-toplevel)
REPO=$(basename "$RAIZ")
DESTINO="$(dirname "$RAIZ")/${REPO}--${SLUG}"

git -C "$RAIZ" fetch origin --quiet 2>/dev/null || true
git -C "$RAIZ" worktree add "$DESTINO" -b "${PREFIJO}/${SLUG}"

# Copia configuración local no versionada (si existe) para que el agente pueda compilar
[ -f "$RAIZ/.env.local" ] && cp "$RAIZ/.env.local" "$DESTINO/"

cat <<EOF

Worktree listo: $DESTINO  (rama ${PREFIJO}/${SLUG})

Abre un panel nuevo en Herdr/tmux y ejecuta:
  cd "$DESTINO" && claude

Cuando el PR se haya fusionado:
  git worktree remove "$DESTINO"
EOF
