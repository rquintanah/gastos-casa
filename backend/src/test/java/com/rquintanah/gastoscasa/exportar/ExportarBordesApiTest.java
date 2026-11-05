package com.rquintanah.gastoscasa.exportar;

import static org.assertj.core.api.Assertions.assertThat;

import com.rquintanah.gastoscasa.PostgresTestcontainers;
import java.nio.charset.StandardCharsets;
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

/** Casos borde de la exportación (QA): límites de mes, importes grandes, notas raras, parámetro repetido. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestcontainers.class)
@Transactional
class ExportarBordesApiTest {

    private static final String EXPORT = "/api/gastos/export";
    private static final String CABECERA = "﻿fecha;categoria;importe;nota\r\n";

    @Autowired
    private MockMvcTester mvc;

    @ParameterizedTest(name = "{0}: primer y ultimo dia entran, los vecinos no")
    @CsvSource({"2024-02,2024-02-29", "2026-02,2026-02-28", "2026-01,2026-01-31", "2026-04,2026-04-30", "2025-12,2025-12-31"})
    void limitesDelMes(String mes, String ultimo) {
        String primero = mes + "-01";
        crear(java.time.LocalDate.parse(primero).minusDays(1).toString(), "1", null);
        crear(java.time.LocalDate.parse(ultimo).plusDays(1).toString(), "2", null);
        crear(primero, "3", "primero");
        crear(ultimo, "4", "ultimo");

        assertThat(cuerpo(get(mes))).isEqualTo(CABECERA
                + primero + ";Comida;3.00;primero\r\n"
                + ultimo + ";Comida;4.00;ultimo\r\n");
    }

    @Test
    void importeMaximoPermitido() {
        crear("2026-02-10", "9999999999.99", null);

        assertThat(cuerpo(get("2026-02"))).isEqualTo(CABECERA + "2026-02-10;Comida;9999999999.99;\r\n");
    }

    @Test
    void notasRarasViajanIntactas() {
        crear("2026-02-01", "1", "-5 soles");
        crear("2026-02-02", "1", "'");
        crear("2026-02-03", "1", "a\\rb"); // CR suelto en medio
        crear("2026-02-04", "1", "pizza 🍕 日本 😀");
        crear("2026-02-05", "1", "'=ya con apóstrofo");
        crear("2026-02-06", "1", "   ");
        crear("2026-02-07", "1", "");

        assertThat(cuerpo(get("2026-02"))).isEqualTo(CABECERA
                + "2026-02-01;Comida;1.00;'-5 soles\r\n"
                + "2026-02-02;Comida;1.00;'\r\n"
                + "2026-02-03;Comida;1.00;\"a\rb\"\r\n"
                + "2026-02-04;Comida;1.00;pizza 🍕 日本 😀\r\n"
                + "2026-02-05;Comida;1.00;'=ya con apóstrofo\r\n"
                + "2026-02-06;Comida;1.00;\r\n"
                + "2026-02-07;Comida;1.00;\r\n");
    }

    @Test
    void emojiSeCodificaEnUtf8DeCuatroBytes() throws Exception {
        crear("2026-02-04", "1", "🍕");

        byte[] bytes = get("2026-02").getResponse().getContentAsByteArray();
        assertThat(bytes).containsSequence((byte) 0xF0, (byte) 0x9F, (byte) 0x8D, (byte) 0x95);
    }

    @Test
    void mesRepetidoNoDa500() {
        MvcTestResult res = mvc.get().uri(EXPORT + "?mes=2026-02&mes=2026-03").exchange();

        assertThat(res.getResponse().getStatus()).isIn(200, 400);
    }

    @Test
    void mesConEspaciosOSoloEspacioDa400() {
        assertThat(mvc.get().uri(EXPORT).param("mes", " ")).hasStatus(HttpStatus.BAD_REQUEST);
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

    /** La nota se pasa con escapes JSON ya escritos (p. ej. \\r) para poder enviar CR/LF. */
    private void crear(String fecha, String importe, String notaJsonSinComillas) {
        String nota = notaJsonSinComillas == null ? "null" : "\"" + notaJsonSinComillas.replace("\"", "\\\"") + "\"";
        String cuerpo = """
                {"fecha":"%s","importe":%s,"categoriaId":2,"nota":%s}""".formatted(fecha, importe, nota);
        assertThat(mvc.post().uri("/api/gastos").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .hasStatus(HttpStatus.CREATED);
    }
}
