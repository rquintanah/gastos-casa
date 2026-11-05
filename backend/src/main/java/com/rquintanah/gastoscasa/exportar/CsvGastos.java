package com.rquintanah.gastoscasa.exportar;

import com.rquintanah.gastoscasa.gasto.GastoDto;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** CSV de gastos para Excel en español: UTF-8 con BOM, separador ';', CRLF, escape RFC 4180 y neutralización de fórmulas. */
final class CsvGastos {

    static final String CABECERA = "fecha;categoria;importe;nota";

    private static final String BOM = "﻿";
    private static final String FIN_LINEA = "\r\n";
    private static final String CARACTERES_DE_FORMULA = "=+-@\t\r";

    private CsvGastos() {}

    /** BOM + cabecera + una fila por gasto, en el orden recibido. */
    static byte[] generar(List<GastoDto> gastos) {
        StringBuilder csv = new StringBuilder(BOM).append(CABECERA).append(FIN_LINEA);
        for (GastoDto gasto : gastos) {
            csv.append(gasto.fecha()).append(';')
                    .append(campoTexto(gasto.categoria().nombre())).append(';')
                    .append(gasto.importe().setScale(2, RoundingMode.UNNECESSARY).toPlainString()).append(';')
                    .append(campoTexto(gasto.nota())).append(FIN_LINEA);
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    /** null → vacío; si empieza por un carácter de fórmula antepone ', y entrecomilla si hace falta. */
    static String campoTexto(String valor) {
        if (valor == null) {
            return "";
        }
        String texto = valor;
        if (!texto.isEmpty() && CARACTERES_DE_FORMULA.indexOf(texto.charAt(0)) >= 0) {
            texto = "'" + texto;
        }
        if (texto.indexOf(';') >= 0 || texto.indexOf(',') >= 0 || texto.indexOf('"') >= 0
                || texto.indexOf('\r') >= 0 || texto.indexOf('\n') >= 0) {
            return '"' + texto.replace("\"", "\"\"") + '"';
        }
        return texto;
    }
}
