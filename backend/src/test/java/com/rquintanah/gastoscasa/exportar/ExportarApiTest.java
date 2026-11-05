package com.rquintanah.gastoscasa.exportar;

import static org.assertj.core.api.Assertions.assertThat;

import com.rquintanah.gastoscasa.PostgresTestcontainers;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.transaction.annotation.Transactional;

/** Exportación CSV contra PostgreSQL real. Cada test se revierte (@Transactional). */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainers.class)
@Transactional
class ExportarApiTest {

    private static final String EXPORT = "/api/gastos/export";
    private static final String CABECERA = "﻿fecha;categoria;importe;nota\r\n";

    @Autowired
    private MockMvcTester mvc;

    @Test
    void cabecerasDeLaRespuesta() throws Exception {
        MvcTestResult res = mvc.get().uri(EXPORT).param("mes", "2026-02").exchange();

        assertThat(res).hasStatusOk();
        MediaType tipo = MediaType.parseMediaType(res.getResponse().getContentType());
        assertThat(tipo.isCompatibleWith(MediaType.parseMediaType("text/csv"))).isTrue();
        assertThat(tipo.getCharset()).isEqualTo(StandardCharsets.UTF_8);
        ContentDisposition cd = ContentDisposition.parse(res.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION));
        assertThat(cd.getType()).isEqualTo("attachment");
        assertThat(cd.getFilename()).isEqualTo("gastos-2026-02.csv");
        assertThat(res.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
    }

    @Test
    void soloLasFilasDelMesEnOrdenCronologico() {
        crear("2026-01-31", "999.00", 3, null);
        crear("2026-03-01", "999.00", 4, null);
        crear("2026-02-28", "234.5", 1, "Alquiler");
        crear("2026-02-03", "10.25", 2, "primero");
        crear("2026-02-03", "5", 5, "segundo");

        assertThat(cuerpo(get("2026-02"))).isEqualTo(CABECERA
                + "2026-02-03;Comida;10.25;primero\r\n"
                + "2026-02-03;Ocio;5.00;segundo\r\n"
                + "2026-02-28;Vivienda;234.50;Alquiler\r\n");
    }

    @Test
    void elCuerpoEmpiezaPorLosTresBytesDelBom() throws Exception {
        byte[] bytes = get("2026-02").getResponse().getContentAsByteArray();

        assertThat(bytes).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
    }

    @Test
    void notaConSeparadorComillasYSaltoDeLinea() {
        crear("2026-02-10", "12", 2, "pan; leche y \"huevos\"\nsegunda línea");

        assertThat(cuerpo(get("2026-02"))).isEqualTo(CABECERA
                + "2026-02-10;Comida;12.00;\"pan; leche y \"\"huevos\"\"\nsegunda línea\"\r\n");
    }

    @Test
    void notaConFormulaSeNeutraliza() {
        crear("2026-02-10", "12", 2, "=1+1");
        crear("2026-02-11", "12", 2, "@SUM(A1)");

        assertThat(cuerpo(get("2026-02"))).isEqualTo(CABECERA
                + "2026-02-10;Comida;12.00;'=1+1\r\n"
                + "2026-02-11;Comida;12.00;'@SUM(A1)\r\n");
    }

    @Test
    void mesSinGastosYMesFuturoSoloTienenCabecera() {
        crear("2026-02-10", "12", 2, null);

        assertThat(cuerpo(get("2025-06"))).isEqualTo(CABECERA);
        assertThat(cuerpo(get("2099-01"))).isEqualTo(CABECERA);
    }

    @Test
    void sinMesOMesVacioDevuelve400() {
        assertMesObligatorio(mvc.get().uri(EXPORT));
        assertMesObligatorio(mvc.get().uri(EXPORT).param("mes", ""));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"2026-13", "2026-00", "2026-1", "202611", "nov-2026", "2026-11-01", "abc"})
    void rechazaMesMalFormado(String mes) {
        assertThat(mvc.get().uri(EXPORT).param("mes", mes))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Datos inválidos");
                    assertThat(json).extractingPath("$.errores.mes")
                            .isEqualTo("El mes debe tener el formato AAAA-MM, por ejemplo 2026-11");
                });
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"-0001-01", "10000-01"})
    void rechazaAnioFueraDeRango(String mes) {
        assertThat(mvc.get().uri(EXPORT).param("mes", mes))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson()
                .extractingPath("$.errores.mes")
                .isNotNull(); // YearMonth rechaza estos años al convertir: sale el mensaje de formato
    }

    @Test
    void laRutaExportNoLaAtiendeElDetallePorId() {
        assertThat(mvc.get().uri(EXPORT)).hasStatus(HttpStatus.BAD_REQUEST).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.errores.mes").isEqualTo("El mes es obligatorio");
            assertThat(json).doesNotHavePath("$.errores.id");
        });
    }

    @Test
    void el400ConAcceptCsvSigueSiendoProblemJson() {
        MvcTestResult res = mvc.get().uri(EXPORT).header(HttpHeaders.ACCEPT, "text/csv,*/*").exchange();

        assertThat(res).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(res.getResponse().getContentType()).startsWith("application/problem+json");
    }

    private void assertMesObligatorio(MockMvcTester.MockMvcRequestBuilder peticion) {
        assertThat(peticion).hasStatus(HttpStatus.BAD_REQUEST).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Datos inválidos");
            assertThat(json).extractingPath("$.errores.mes").isEqualTo("El mes es obligatorio");
        });
    }

    private MvcTestResult get(String mes) {
        return mvc.get().uri(EXPORT).param("mes", mes).exchange();
    }

    private static String cuerpo(MvcTestResult res) {
        try {
            return res.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private void crear(String fecha, String importe, int categoriaId, String nota) {
        String notaJson = nota == null ? "null" : "\"" + nota.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
        String cuerpo = """
                {"fecha":"%s","importe":%s,"categoriaId":%d,"nota":%s}""".formatted(fecha, importe, categoriaId, notaJson);
        assertThat(mvc.post().uri("/api/gastos").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .hasStatus(HttpStatus.CREATED);
    }
}
