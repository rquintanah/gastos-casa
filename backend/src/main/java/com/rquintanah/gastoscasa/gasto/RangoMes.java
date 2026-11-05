package com.rquintanah.gastoscasa.gasto;

import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import java.time.LocalDate;
import java.time.YearMonth;

/** Intervalo semiabierto [desde, hasta) de un mes; aprovecha ix_gasto_fecha. */
public record RangoMes(LocalDate desde, LocalDate hasta) {

    public static final String MENSAJE_OBLIGATORIO = "El mes es obligatorio";
    public static final String MENSAJE_FUERA_DE_RANGO = "El mes debe estar entre 0001-01 y 9999-12";

    /** @throws DatoInvalidoException con campo "mes" si el año no está en 1..9999 (evita DateTimeException → 500). */
    public static RangoMes de(YearMonth mes) {
        if (mes.getYear() < 1 || mes.getYear() > 9999) {
            throw new DatoInvalidoException("mes", MENSAJE_FUERA_DE_RANGO);
        }
        return new RangoMes(mes.atDay(1), mes.plusMonths(1).atDay(1));
    }
}
