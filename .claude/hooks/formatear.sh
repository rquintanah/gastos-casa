#!/usr/bin/env bash
# Hook PostToolUse: formatea el archivo recién editado. Nunca bloquea (siempre sale con 0).
set -uo pipefail

ruta=$(python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)
[ -z "$ruta" ] || [ ! -f "$ruta" ] && exit 0

case "$ruta" in
  *.ts|*.html|*.scss|*.css|*.json)
    # Prettier del proyecto, si existe (busca node_modules hacia arriba)
    dir=$(dirname "$ruta")
    while [ "$dir" != "/" ] && [ ! -x "$dir/node_modules/.bin/prettier" ]; do dir=$(dirname "$dir"); done
    [ -x "$dir/node_modules/.bin/prettier" ] && "$dir/node_modules/.bin/prettier" --write "$ruta" >/dev/null 2>&1
    ;;
  *.java)
    # google-java-format, si está instalado en el PATH
    command -v google-java-format >/dev/null && google-java-format --replace "$ruta" >/dev/null 2>&1
    ;;
esac
exit 0
