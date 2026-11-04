#!/usr/bin/env bash
# Hook PreToolUse (Read|Edit|Write): bloquea que el agente lea o edite secretos o archivos protegidos.
# Claude Code envía por stdin un JSON con tool_name y tool_input.file_path. Salir con código 2 = bloquear.
# Va junto con los "deny" de .claude/settings.json: si cambias uno, revisa el otro.
set -uo pipefail

datos=$(python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_name","")); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)
herramienta=$(printf '%s\n' "$datos" | sed -n 1p)
ruta=$(printf '%s\n' "$datos" | sed -n 2p)
[ -z "$ruta" ] && exit 0

# .git/: se puede leer, pero no editar
case "$ruta" in
  */.git/*)
    [ "$herramienta" = "Read" ] && exit 0
    echo "BLOQUEADO por proteger-archivos.sh: '$ruta' está dentro de .git/. No se edita a mano." >&2
    exit 2
    ;;
esac

case "$ruta" in
  *.env.example)
    exit 0 # plantilla sin secretos: se puede leer y editar
    ;;
  *.env|*.env.*|*.pem|*.key|*.p12|*.jks|*application-prod.yml|*application-prod.properties)
    echo "BLOQUEADO por proteger-archivos.sh: '$ruta' es un archivo protegido (secretos/config de producción). Pide al humano que lo gestione." >&2
    exit 2
    ;;
esac
exit 0
