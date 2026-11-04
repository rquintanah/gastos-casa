package com.rquintanah.gastoscasa.gasto;

import static org.assertj.core.api.Assertions.assertThat;

import com.rquintanah.gastoscasa.PostgresTestcontainers;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.transaction.annotation.Transactional;

/** API de gastos y categorías contra PostgreSQL real. Cada test se revierte (@Transactional). */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainers.class)
@Transactional
class GastoApiTest {

    private static final LocalDate HOY = LocalDate.now();

    @Autowired
    private MockMvcTester mvc;

    @Test
    void listaLasSeisCategoriasOrdenadasPorNombre() {
        assertThat(mvc.get().uri("/api/categorias"))
                .hasStatusOk()
                .bodyJson()
                .extractingPath("$[*].nombre")
                .asArray()
                .containsExactly("Comida", "Ocio", "Otros", "Salud", "Transporte", "Vivienda");
    }

    @Test
    void creaUnGastoYLoDevuelveConSuCategoria() {
        MvcTestResult resultado = crear(json(HOY, "45.5", 2, "  Mercado  "));

        assertThat(resultado).hasStatus(HttpStatus.CREATED).headers().containsHeader("Location");
        assertThat(resultado).bodyJson().extractingPath("$.importe").isEqualTo(45.50);
        assertThat(resultado).bodyJson().asString().contains("\"importe\":45.50");
        assertThat(resultado).bodyJson().extractingPath("$.fecha").isEqualTo(HOY.toString());
        assertThat(resultado).bodyJson().extractingPath("$.categoria.nombre").isEqualTo("Comida");
        assertThat(resultado).bodyJson().extractingPath("$.nota").isEqualTo("Mercado");
    }

    @Test
    void notaVaciaSeGuardaComoNula() {
        assertThat(crear(json(HOY, "10", 1, "   "))).bodyJson().extractingPath("$.nota").isNull();
    }

    @Test
    void listaDelMasRecienteAlMasAntiguo() {
        crear(json(HOY.minusDays(5), "1", 1, null));
        crear(json(HOY, "2", 1, null));
        crear(json(HOY.minusDays(1), "3", 1, null));

        assertThat(mvc.get().uri("/api/gastos"))
                .hasStatusOk()
                .bodyJson()
                .extractingPath("$[*].fecha")
                .asArray()
                .containsExactly(HOY.toString(), HOY.minusDays(1).toString(), HOY.minusDays(5).toString());
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            importe cero               | {"fecha":"2026-01-10","importe":0,"categoriaId":1}          | importe
            importe negativo           | {"fecha":"2026-01-10","importe":-5,"categoriaId":1}         | importe
            importe con 3 decimales    | {"fecha":"2026-01-10","importe":1.234,"categoriaId":1}      | importe
            importe ausente            | {"fecha":"2026-01-10","categoriaId":1}                      | importe
            fecha ausente              | {"importe":10,"categoriaId":1}                              | fecha
            categoría ausente          | {"fecha":"2026-01-10","importe":10}                         | categoriaId
            categoría inexistente      | {"fecha":"2026-01-10","importe":10,"categoriaId":99}        | categoriaId
            """)
    void rechazaDatosInvalidosIndicandoElCampo(String caso, String cuerpo, String campo) {
        assertThat(crear(cuerpo))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .extractingPath("$.errores." + campo)
                .isNotNull();
    }

    @Test
    void rechazaFechaFutura() {
        assertThat(crear(json(HOY.plusDays(2), "10", 1, null)))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .extractingPath("$.errores.fecha")
                .isEqualTo("La fecha no puede ser futura");
    }

    @Test
    void rechazaNotaDeMasDe500Caracteres() {
        assertThat(crear(json(HOY, "10", 1, "x".repeat(501))))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .extractingPath("$.errores.nota")
                .isNotNull();
    }

    @Test
    void rechazaJsonMalFormado() {
        assertThat(crear("{\"importe\": \"abc\"")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void actualizaYBorraUnGasto() throws Exception {
        Number id = idDe(crear(json(HOY, "10", 1, null)));

        assertThat(mvc.put().uri("/api/gastos/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content(json(HOY.minusDays(1), "99.90", 3, "Taxi")))
                .hasStatusOk()
                .bodyJson()
                .extractingPath("$.categoria.nombre")
                .isEqualTo("Transporte");
        assertThat(mvc.get().uri("/api/gastos/{id}", id)).bodyJson().extractingPath("$.importe").isEqualTo(99.90);

        assertThat(mvc.delete().uri("/api/gastos/{id}", id)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/gastos/{id}", id)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void devuelve404SiElGastoNoExiste() {
        assertThat(mvc.get().uri("/api/gastos/999999")).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.title").isEqualTo("No encontrado");
        assertThat(mvc.put().uri("/api/gastos/999999").contentType(MediaType.APPLICATION_JSON)
                .content(json(HOY, "1", 1, null))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.delete().uri("/api/gastos/999999")).hasStatus(HttpStatus.NOT_FOUND);
    }

    private MvcTestResult crear(String cuerpo) {
        return mvc.post().uri("/api/gastos").contentType(MediaType.APPLICATION_JSON).content(cuerpo).exchange();
    }

    private Number idDe(MvcTestResult resultado) throws Exception {
        assertThat(resultado).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
    }

    private static String json(LocalDate fecha, String importe, int categoriaId, String nota) {
        String notaJson = nota == null ? "null" : "\"" + nota + "\"";
        return """
                {"fecha":"%s","importe":%s,"categoriaId":%d,"nota":%s}"""
                .formatted(fecha, importe, categoriaId, notaJson);
    }
}
