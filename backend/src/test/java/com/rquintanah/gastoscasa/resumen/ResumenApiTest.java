package com.rquintanah.gastoscasa.resumen;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import com.rquintanah.gastoscasa.PostgresTestcontainers;
import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.transaction.annotation.Transactional;

/** API del resumen por categoría contra PostgreSQL real. Cada test se revierte (@Transactional). */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainers.class)
@Transactional
class ResumenApiTest {

    private static final String RESUMEN = "/api/gastos/resumen";

    @Autowired
    private MockMvcTester mvc;

    @Test
    void agrupaPorCategoriaSoloDelMesOrdenadoYConDosDecimales() {
        datosDeFebrero();

        MvcTestResult res = mvc.get().uri(RESUMEN).param("mes", "2026-02").exchange();

        assertThat(res).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.length()").isEqualTo(3);
            assertThat(json).extractingPath("$[*].categoria.nombre").asArray()
                    .containsExactly("Vivienda", "Comida", "Ocio");
            assertThat(json).extractingPath("$[*].categoria.id").asArray().containsExactly(1, 2, 5);
            assertThat(json).extractingPath("$[*].total").asArray().containsExactly(1234.50, 80.00, 80.00);
            assertThat(json).extractingPath("$[*].cantidad").asArray().containsExactly(2, 3, 1);
            assertThat(json).asString().contains("\"total\":1234.50").contains("\"total\":80.00");
        });
    }

    @Test
    void soloAparecenLasCategoriasConGastos() {
        datosDeFebrero();

        assertThat(mvc.get().uri(RESUMEN).param("mes", "2026-02"))
                .bodyJson()
                .extractingPath("$[*].categoria.nombre")
                .asArray()
                .doesNotContain("Transporte", "Salud", "Otros");
    }

    @Test
    void mesSinGastosYMesFuturoDevuelvenListaVacia() {
        datosDeFebrero();

        assertThat(mvc.get().uri(RESUMEN).param("mes", "2025-06")).hasStatusOk().bodyJson().isEqualTo("[]");
        assertThat(mvc.get().uri(RESUMEN).param("mes", YearMonth.now().plusMonths(1).toString()))
                .hasStatusOk()
                .bodyJson()
                .isEqualTo("[]");
    }

    @Test
    void sinMesOMesVacioDevuelve400() {
        assertMesObligatorio(mvc.get().uri(RESUMEN));
        assertMesObligatorio(mvc.get().uri(RESUMEN).param("mes", ""));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"2026-13", "2026-00", "2026-1", "202611", "nov-2026", "2026-11-01", "abc", "-0001-01", "10000-01"})
    void rechazaMesInvalido(String mes) {
        assertThat(mvc.get().uri(RESUMEN).param("mes", mes))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Datos inválidos");
                    assertThat(json).extractingPath("$.errores.mes").isNotNull();
                });
    }

    @Test
    void laRutaResumenNoLaAtiendeElDetallePorId() throws Exception {
        Number id = idDe(crear("2026-02-10", "50.00", 2));

        // /resumen devuelve filas de resumen (categoria/total/cantidad), no un gasto ni un error de id
        assertThat(mvc.get().uri(RESUMEN).param("mes", "2026-02")).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.length()").isEqualTo(1);
            assertThat(json).extractingPath("$[0].categoria.nombre").isEqualTo("Comida");
            assertThat(json).extractingPath("$[0].total").isEqualTo(50.00);
            assertThat(json).extractingPath("$[0].cantidad").isEqualTo(1);
            assertThat(json).doesNotHavePath("$[0].fecha");
            assertThat(json).doesNotHavePath("$[0].importe");
            assertThat(json).doesNotHavePath("$.errores");
        });
        // sin mes tampoco cae en /{id}: el error es de "mes", no de "id"
        assertThat(mvc.get().uri(RESUMEN)).hasStatus(HttpStatus.BAD_REQUEST).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.errores.mes").isEqualTo("El mes es obligatorio");
            assertThat(json).doesNotHavePath("$.errores.id");
        });
        // y el detalle por id sigue funcionando
        assertThat(mvc.get().uri("/api/gastos/{id}", id)).hasStatusOk().bodyJson()
                .extractingPath("$.importe").isEqualTo(50.00);
        // un id no numérico distinto de "resumen" sí es un error de id
        assertThat(mvc.get().uri("/api/gastos/resumenes")).hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .extractingPath("$.errores.id").isNotNull();
    }

    @Test
    void elResumenSigueAEdicionesYBorrados() throws Exception {
        Number id = idDe(crear("2026-02-10", "50.00", 2));
        crear("2026-02-11", "20.00", 2);

        assertThat(mvc.get().uri(RESUMEN).param("mes", "2026-02"))
                .bodyJson().extractingPath("$[0].total").isEqualTo(70.00);

        // Editar: pasa a Ocio y a marzo
        assertThat(mvc.put().uri("/api/gastos/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo("2026-03-02", "50.00", 5)))
                .hasStatusOk();
        assertThat(mvc.get().uri(RESUMEN).param("mes", "2026-02"))
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.length()").isEqualTo(1);
                    assertThat(json).extractingPath("$[0].total").isEqualTo(20.00);
                });
        assertThat(mvc.get().uri(RESUMEN).param("mes", "2026-03"))
                .bodyJson().extractingPath("$[0].categoria.nombre").isEqualTo("Ocio");

        // Borrar
        assertThat(mvc.delete().uri("/api/gastos/{id}", id)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri(RESUMEN).param("mes", "2026-03")).bodyJson().isEqualTo("[]");
    }

    private void assertMesObligatorio(org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder peticion) {
        assertThat(peticion)
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Datos inválidos");
                    assertThat(json).extractingPath("$.errores.mes").isEqualTo("El mes es obligatorio");
                });
    }

    private void datosDeFebrero() {
        crear("2026-01-31", "999.00", 3);
        crear("2026-03-01", "999.00", 4);
        crear("2026-02-01", "1000.00", 1);
        crear("2026-02-28", "234.50", 1);
        crear("2026-02-03", "10.25", 2);
        crear("2026-02-04", "30.25", 2);
        crear("2026-02-05", "39.50", 2);
        crear("2026-02-06", "80.00", 5);
    }

    private MvcTestResult crear(String fecha, String importe, int categoriaId) {
        return mvc.post().uri("/api/gastos").contentType(MediaType.APPLICATION_JSON)
                .content(cuerpo(fecha, importe, categoriaId)).exchange();
    }

    private Number idDe(MvcTestResult resultado) throws Exception {
        assertThat(resultado).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
    }

    private static String cuerpo(String fecha, String importe, int categoriaId) {
        return """
                {"fecha":"%s","importe":%s,"categoriaId":%d}""".formatted(fecha, importe, categoriaId);
    }
}
