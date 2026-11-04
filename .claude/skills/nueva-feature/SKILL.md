---
name: nueva-feature
description: Flujo completo del equipo para construir una funcionalidad nueva, desde el requerimiento o issue hasta el Pull Request. Úsala cuando el usuario pida implementar una funcionalidad, historia de usuario o issue.
---

# Receta: nueva funcionalidad (de tarjeta a PR)

Tú (sesión principal) eres el **líder técnico / orquestador**. No construyes todo tú: delegas en subagentes y verificas.

## Paso 0 — Contexto
1. Lee `CLAUDE.md`.
2. Lee `/mnt/d/ProyectosIA/software/cerebro/00-Indice.md` y las notas de `aprendizajes/` relacionadas con este repo o tema.
3. Si el requerimiento viene de un issue: `gh issue view <n> --comments`.
4. **Comprueba que los subagentes del repo están disponibles** (`arquitecto`, `backend-java`, `frontend-angular`, `qa`,
   `seguridad`, `documentador`…). Solo se cargan si la sesión de Claude arrancó **dentro del repo**
   (`cd ~/software/proyectos/<repo> && claude`); lo mismo pasa con sus hooks y sus `deny`. Si no están:
   - avisa al usuario (en esta sesión no se aplican los hooks ni los `deny` del repo) y recomiéndale reabrir dentro del repo;
   - si decide seguir, lanza cada rol como agente `general-purpose` con el `model:` de su definición y la instrucción de
     leer y seguir `.claude/agents/<rol>.md`.

## Paso 1 — Rama
- Si la tarea es independiente de otras en curso: `scripts/nuevo-worktree.sh <slug>` (carpeta aislada para trabajar en paralelo).
- Si no: `git switch -c feat/<slug>`.

## Paso 2 — Plan
- Delega en **arquitecto**: "Planifica <requerimiento>".
- Si el plan dice **Requiere aprobación humana: SÍ** → muestra el resumen al usuario y **detente** hasta que apruebe.

## Paso 3 — Construcción (en paralelo cuando se pueda)
- Lanza a la vez los subagentes de las tareas sin dependencias: **datos**, **backend-java**, **frontend-angular**, **devops**.
- Pásale a cada uno: el archivo del plan, su número de tarea y el contrato (DTO/endpoint) acordado.
- Si trabajan **en paralelo sobre la misma carpeta**, asigna a cada uno carpetas que no se solapen (p. ej. `backend/` y
  `frontend/src/`) y prohíbeles hacer commits, cambiar de rama o añadir dependencias. Los commits los haces tú al verificar.
- Al volver, verifica tú mismo: `./mvnw -q test` y tests de frontend (y comprueba con `git status` que nadie salió de su carpeta).

## Paso 4 — Calidad
1. **qa** → si FALLA, devuelve los bugs al subagente constructor correspondiente. Máximo 2 vueltas; si sigue fallando, detente e informa.
2. **seguridad** → si BLOQUEANTE, corrige y repite.
3. Skill **revision-cruzada** (Codex). Atiende hallazgos CRÍTICOS/ALTOS.

## Paso 5 — Entrega
1. Commits en Conventional Commits (en español).
2. **documentador** → `.revision/pr-body.md` y CHANGELOG. Pásale los datos ya verificados (número de tests, veredictos de
   QA, seguridad y Codex) y revisa su texto antes de publicarlo. La sección «Cómo probar» debe incluir la prueba local sin
   tocar los datos reales: `gh pr checkout <n>` y un stack aparte con `docker compose -p <repo>-pr up -d --build`.
3. `git push -u origin <rama>` y `gh pr create --title "<tipo>: <resumen>" --body-file .revision/pr-body.md`.
4. **Nunca** hagas merge. Comparte el enlace del PR.

## Paso 6 — Cierre
- Skill **cierre-sesion**.
