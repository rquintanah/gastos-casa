---
name: cierre-sesion
description: Al terminar una tarea o sesión de trabajo, escribe en el segundo cerebro (vault de Obsidian) qué se hizo, qué se decidió y qué se aprendió. Úsala al final de cada tarea o cuando el usuario diga que terminó.
---

# Receta: cierre de sesión (escribir en el cerebro)

Vault: `/mnt/d/ProyectosIA/software/cerebro`

1. **Nota de sesión** → `sesiones/<AAAA-MM-DD>-<repo>-<slug>.md` usando `plantillas/sesion.md`:
   - Qué se pidió · qué se hizo · PR/rama · qué quedó pendiente.
   - Enlaza con `[[nombre-de-nota]]` los aprendizajes o ADR relacionados.
2. **Aprendizajes** (solo si hubo algo no obvio) → `aprendizajes/<slug>.md` con `plantillas/aprendizaje.md`:
   síntoma → causa raíz → solución → cómo evitarlo. Etiquetas: `#repo/<nombre>` `#tema/<tema>`.
   Si ya existe una nota del mismo tema, **actualízala** en lugar de duplicar.
3. **Pendientes** → por cada "luego lo vemos" crea un issue: `gh issue create --title "…" --label pendiente`.
   (Los issues con etiqueta `autopilot` los toma el robot nocturno.)
4. **Índice** → si creaste un aprendizaje o ADR nuevo, añade su enlace en `00-Indice.md`.
5. Responde al usuario con 3 líneas: hecho · pendiente · aprendido.

No escribas secretos, credenciales ni datos personales en el cerebro.
