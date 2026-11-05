package com.rquintanah.gastoscasa.exportar;

import static org.assertj.core.api.Assertions.assertThat;

import com.rquintanah.gastoscasa.categoria.CategoriaDto;
import com.rquintanah.gastoscasa.gasto.GastoDto;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class CsvGastosTest {

    private static final String BOM = "﻿";

    @Test
    void listaVaciaEsBomMasCabeceraConCrlf() {
        byte[] esperado = new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] cabecera = "fecha;categoria;importe;nota\r\n".getBytes(StandardCharsets.UTF_8);
        byte[] todo = new byte[esperado.length + cabecera.length];
        System.arraycopy(esperado, 0, todo, 0, esperado.length);
        System.arraycopy(cabecera, 0, todo, esperado.length, cabecera.length);

        assertThat(CsvGastos.generar(List.of())).isEqualTo(todo);
    }

    @Test
    void elBomApareceUnaSolaVez() {
        String csv = texto(gasto("2026-11-02", "45.5", "Comida", "pan"), gasto("2026-11-03", "1", "Ocio", null));

        assertThat(csv).startsWith(BOM + "fecha;");
        assertThat(csv.indexOf('﻿')).isZero();
        assertThat(csv.lastIndexOf('﻿')).isZero();
    }

    @Test
    void filaSimpleYNotaNula() {
        String csv = texto(gasto("2026-11-02", "45.5", "Comida", "pan"), gasto("2026-11-02", "45.5", "Comida", null));

        assertThat(csv).isEqualTo(BOM + "fecha;categoria;importe;nota\r\n"
                + "2026-11-02;Comida;45.50;pan\r\n"
                + "2026-11-02;Comida;45.50;\r\n");
    }

    @ParameterizedTest
    @CsvSource({"45.5,45.50", "12,12.00", "1234.5,1234.50", "9999999999.99,9999999999.99", "0.01,0.01", "1E+2,100.00"})
    void importeConDosDecimalesSinNotacionCientifica(String entrada, String esperado) {
        String csv = texto(gasto("2026-11-02", entrada, "Comida", null));

        assertThat(csv).endsWith("2026-11-02;Comida;" + esperado + ";\r\n");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', quoteCharacter = '`', value = {
        "a;b|\"a;b\"",
        "di \"hola\"|\"di \"\"hola\"\"\"",
        "1,5 kg|\"1,5 kg\"",
        "texto normal|texto normal",
        "a=b|a=b",
        "Café ñandú €|Café ñandú €",
    })
    void escape(String nota, String esperado) {
        assertThat(CsvGastos.campoTexto(nota)).isEqualTo(esperado);
    }

    @Test
    void saltosDeLineaVanEntreComillasConElSaltoIntacto() {
        assertThat(CsvGastos.campoTexto("línea1\nlínea2")).isEqualTo("\"línea1\nlínea2\"");
        assertThat(CsvGastos.campoTexto("línea1\r\nlínea2")).isEqualTo("\"línea1\r\nlínea2\"");
    }

    @ParameterizedTest
    @ValueSource(strings = {"=1+1", "+51 999", "-20 %", "@SUM(A1)"})
    void neutralizaFormulas(String nota) {
        assertThat(CsvGastos.campoTexto(nota)).isEqualTo("'" + nota);
    }

    @Test
    void neutralizaTabuladorYRetornoInicialYLuegoEntrecomilla() {
        assertThat(CsvGastos.campoTexto("\tx")).isEqualTo("\"'\tx\"");
        assertThat(CsvGastos.campoTexto("\rx")).isEqualTo("\"'\rx\"");
    }

    @Test
    void tabuladorEnMedioEntrecomillaElCampo() {
        assertThat(CsvGastos.campoTexto("a\t=cmd")).isEqualTo("\"a\t=cmd\"");
    }

    @Test
    void neutralizaYDespuesEscapa() {
        assertThat(CsvGastos.campoTexto("=HYPERLINK(\"http://x\";\"y\")"))
                .isEqualTo("\"'=HYPERLINK(\"\"http://x\"\";\"\"y\"\")\"");
        assertThat(CsvGastos.campoTexto("=1+1;x")).isEqualTo("\"'=1+1;x\"");
    }

    @Test
    void campoTextoNuloOVacio() {
        assertThat(CsvGastos.campoTexto(null)).isEmpty();
        assertThat(CsvGastos.campoTexto("")).isEmpty();
    }

    @Test
    void laCategoriaTambienSeNeutraliza() {
        String csv = texto(gasto("2026-11-02", "10", "=X", null));

        assertThat(csv).endsWith("2026-11-02;'=X;10.00;\r\n");
    }

    @Test
    void codificaEnUtf8() {
        byte[] bytes = CsvGastos.generar(List.of(gasto("2026-11-02", "10", "Comida", "Café ñandú €")));

        assertThat(bytes).containsSequence("Café ñandú €".getBytes(StandardCharsets.UTF_8));
        assertThat(bytes).containsSequence((byte) 0xC3, (byte) 0xA9); // é
    }

    @Test
    void cadaFilaSeLeeDeVueltaConCuatroCampos() {
        List<String> notas = List.of("pan", "a;b", "di \"hola\"", "línea1\nlínea2", "línea1\r\nlínea2", "1,5 kg",
                "=1+1", "+51 999", "-20 %", "@SUM(A1)", "\tx", "\rx", "=HYPERLINK(\"http://x\";\"y\")", "a=b",
                "=1+1;x", "\"", ";", "", "Café ñandú");
        List<GastoDto> gastos = new ArrayList<>();
        for (String nota : notas) {
            gastos.add(gasto("2026-11-02", "10", "Comida", nota));
        }
        gastos.add(gasto("2026-11-02", "10", "Comida", null));

        List<List<String>> filas = leer(texto(gastos.toArray(GastoDto[]::new)).substring(1));

        assertThat(filas).hasSize(gastos.size() + 1);
        assertThat(filas).allSatisfy(fila -> assertThat(fila).hasSize(4));
        assertThat(filas.get(0)).containsExactly("fecha", "categoria", "importe", "nota");
        assertThat(filas.get(4).get(3)).isEqualTo("línea1\nlínea2");
        assertThat(filas.get(7).get(3)).isEqualTo("'=1+1");
        assertThat(filas.get(13).get(3)).isEqualTo("'=HYPERLINK(\"http://x\";\"y\")");
    }

    /** Parser RFC 4180 mínimo con separador ';'. */
    private static List<List<String>> leer(String csv) {
        List<List<String>> filas = new ArrayList<>();
        List<String> fila = new ArrayList<>();
        StringBuilder campo = new StringBuilder();
        boolean entrecomillado = false;
        for (int i = 0; i < csv.length(); i++) {
            char c = csv.charAt(i);
            if (entrecomillado) {
                if (c == '"' && i + 1 < csv.length() && csv.charAt(i + 1) == '"') {
                    campo.append('"');
                    i++;
                } else if (c == '"') {
                    entrecomillado = false;
                } else {
                    campo.append(c);
                }
            } else if (c == '"') {
                entrecomillado = true;
            } else if (c == ';') {
                fila.add(campo.toString());
                campo.setLength(0);
            } else if (c == '\r' && i + 1 < csv.length() && csv.charAt(i + 1) == '\n') {
                fila.add(campo.toString());
                campo.setLength(0);
                filas.add(fila);
                fila = new ArrayList<>();
                i++;
            } else {
                campo.append(c);
            }
        }
        assertThat(entrecomillado).isFalse();
        assertThat(campo).isEmpty();
        assertThat(fila).isEmpty();
        return filas;
    }

    private static String texto(GastoDto... gastos) {
        return new String(CsvGastos.generar(List.of(gastos)), StandardCharsets.UTF_8);
    }

    private static GastoDto gasto(String fecha, String importe, String categoria, String nota) {
        return new GastoDto(1L, LocalDate.parse(fecha), new BigDecimal(importe), new CategoriaDto((short) 1, categoria), nota);
    }
}
