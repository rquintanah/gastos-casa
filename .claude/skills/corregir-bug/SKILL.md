---
name: corregir-bug
description: Receta para corregir un bug reportado (issue, log de error, stacktrace o descripción). Primero reproduce con un test que falla, luego corrige. Úsala cuando el usuario reporte un error o comportamiento incorrecto.
---

# Receta: corregir un bug

1. **Contexto**: lee `CLAUDE.md` y busca en `/mnt/d/ProyectosIA/software/cerebro/aprendizajes/` si el error ya apareció antes.
2. **Rama**: `git switch -c fix/<slug>`.
3. **Localiza**: a partir del stacktrace/log, encuentra el punto de falla con Grep. Formula la causa raíz en una frase antes de tocar código.
4. **Reproduce**: escribe un test que **falle** por el bug. Ejecútalo y confirma que falla por la razón correcta.
5. **Corrige** lo mínimo necesario (delega en `backend-java` / `frontend-angular` si el cambio es grande).
6. **Verifica**: el test nuevo pasa y la suite completa sigue verde.
7. **Revisa**: subagente `seguridad` + skill `revision-cruzada`.
8. **Entrega**: commit `fix: …`, `documentador` para el PR, `gh pr create`. Sin merge.
9. **Aprende**: skill `cierre-sesion`; si la causa fue no obvia, crea una nota en `aprendizajes/` (síntoma → causa → solución).
