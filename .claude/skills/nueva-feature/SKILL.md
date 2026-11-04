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

## Paso 1 — Rama
- Si la tarea es independiente de otras en curso: `scripts/nuevo-worktree.sh <slug>` (carpeta aislada para trabajar en paralelo).
- Si no: `git switch -c feat/<slug>`.

## Paso 2 — Plan
- Delega en **arquitecto**: "Planifica <requerimiento>".
- Si el plan dice **Requiere aprobación humana: SÍ** → muestra el resumen al usuario y **detente** hasta que apruebe.

## Paso 3 — Construcción (en paralelo cuando se pueda)
- Lanza a la vez los subagentes de las tareas sin dependencias: **datos**, **backend-java**, **frontend-angular**, **devops**.
- Pásale a cada uno: el archivo del plan, su número de tarea y el contrato (DTO/endpoint) acordado.
- Al volver, verifica tú mismo: `./mvnw -q test` y tests de frontend.

## Paso 4 — Calidad
1. **qa** → si FALLA, devuelve los bugs al subagente constructor correspondiente. Máximo 2 vueltas; si sigue fallando, detente e informa.
2. **seguridad** → si BLOQUEANTE, corrige y repite.
3. Skill **revision-cruzada** (Codex). Atiende hallazgos CRÍTICOS/ALTOS.

## Paso 5 — Entrega
1. Commits en Conventional Commits (en español).
2. **documentador** → `.revision/pr-body.md` y CHANGELOG.
3. `git push -u origin <rama>` y `gh pr create --title "<tipo>: <resumen>" --body-file .revision/pr-body.md`.
4. **Nunca** hagas merge. Comparte el enlace del PR.

## Paso 6 — Cierre
- Skill **cierre-sesion**.
