package com.rquintanah.gastoscasa;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** Arranca el contexto completo: Flyway aplica V1 y V2 y Hibernate valida el esquema (ddl-auto=validate). */
@SpringBootTest
@Import(PostgresTestcontainers.class)
class GastosCasaApplicationTest {

    @Test
    void arrancaYElEsquemaCoincideConLasEntidades() {
        // si Flyway o la validación de Hibernate fallan, el contexto no arranca y este test falla
    }
}
