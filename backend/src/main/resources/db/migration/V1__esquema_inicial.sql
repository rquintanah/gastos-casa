-- Esquema inicial de gastos-casa.
-- Rollback (Flyway Community no tiene undo): DROP TABLE gasto, categoria;
-- y borrar las filas de flyway_schema_history con version >= 1. En local basta con `docker compose down -v`.

CREATE TABLE categoria (
    id     SMALLINT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE gasto (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha          DATE          NOT NULL,
    importe        NUMERIC(12,2) NOT NULL CHECK (importe > 0),
    categoria_id   SMALLINT      NOT NULL REFERENCES categoria (id),
    nota           VARCHAR(500),
    creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX ix_gasto_fecha ON gasto (fecha DESC);
