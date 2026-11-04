-- Categorías fijas (CLAUDE.md §1). Rollback: DELETE FROM categoria WHERE id BETWEEN 1 AND 6;
INSERT INTO categoria (id, nombre) VALUES
    (1, 'Vivienda'),
    (2, 'Comida'),
    (3, 'Transporte'),
    (4, 'Salud'),
    (5, 'Ocio'),
    (6, 'Otros');
