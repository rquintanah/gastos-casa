#!/usr/bin/env bash
# Revisión cruzada: Codex (otro modelo) revisa los cambios de la rama actual contra la rama base.
# Uso: bash scripts/revision-codex.sh [rama-base]   (por defecto: main)
set -euo pipefail

BASE="${1:-main}"
mkdir -p .revision

# Incluye commits de la rama + cambios sin commitear, también archivos nuevos sin `git add`.
# `git add -N` solo registra la intención de añadirlos (respeta .gitignore): no cambia el contenido del commit.
git add -N .
PUNTO=$(git merge-base "$BASE" HEAD)
git diff "$PUNTO" > .revision/diff.patch

if [ ! -s .revision/diff.patch ]; then
  echo "Sin cambios respecto a $BASE. Nada que revisar."
  exit 0
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI no está instalado. Instálalo con: npm i -g @openai/codex  (y luego: codex login)" >&2
  exit 1
fi

SALIDA=".revision/codex-$(date +%Y%m%d-%H%M%S).md"

# codex exec = modo no interactivo; sandbox de solo lectura: Codex revisa, no modifica.
codex exec --sandbox read-only \
  "Actúa según AGENTS.md (rol: revisor). Revisa el diff del archivo .revision/diff.patch \
(cambios de la rama actual contra $BASE). Puedes abrir los archivos del repo para tener contexto. \
Responde SOLO con el formato de salida definido en AGENTS.md, en español." \
  < /dev/null > "$SALIDA"  # sin stdin: si no, codex exec espera entrada y puede colgarse

echo "$SALIDA"
