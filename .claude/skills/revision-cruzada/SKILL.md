---
name: revision-cruzada
description: Pide a Codex (otro modelo) que revise los cambios de la rama antes de abrir el PR, y procesa sus hallazgos. Úsala siempre antes de crear un Pull Request.
---

# Receta: revisión cruzada con Codex

**Por qué**: dos modelos se equivocan en cosas distintas. Lo que Claude no ve, Codex lo encuentra (y viceversa).

1. Ejecuta: `bash scripts/revision-codex.sh main`
   (genera `.revision/diff.patch` y deja el informe en `.revision/codex-<fecha>.md`; imprime la ruta).
2. Si el script dice que Codex no está instalado, informa al usuario y continúa sin este paso (déjalo indicado en el PR).
3. Lee el informe. Para **cada hallazgo** decide:
   - **ACEPTAR** → corrígelo (o delega en el subagente constructor).
   - **RECHAZAR** → escribe la razón técnica en una línea (p. ej. "falso positivo: el valor se valida en el DTO").
4. Escribe la tabla de decisiones al final del informe:
   `| # | Decisión | Motivo / commit |`
5. Si aceptaste hallazgos CRÍTICOS o ALTOS, vuelve a ejecutar la revisión una vez más.
6. `.revision/` no se commitea (está en `.gitignore`); el resumen va en la descripción del PR.
