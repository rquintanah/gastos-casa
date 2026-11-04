package com.rquintanah.gastoscasa.gasto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;

class RangoMesTest {

    @Test
    void diciembreTerminaEnEneroDelAnioSiguiente() {
        RangoMes rango = RangoMes.de(YearMonth.of(2026, 12));
        assertThat(rango.desde()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(rango.hasta()).isEqualTo(LocalDate.of(2027, 1, 1));
    }

    @Test
    void febreroBisiestoTerminaEnMarzo() {
        RangoMes rango = RangoMes.de(YearMonth.of(2024, 2));
        assertThat(rango.desde()).isEqualTo(LocalDate.of(2024, 2, 1));
        assertThat(rango.hasta()).isEqualTo(LocalDate.of(2024, 3, 1));
    }

    @Test
    void aceptaLosExtremosDelRango() {
        assertThat(RangoMes.de(YearMonth.of(1, 1)).desde()).isEqualTo(LocalDate.of(1, 1, 1));
        assertThat(RangoMes.de(YearMonth.of(9998, 12)).hasta()).isEqualTo(LocalDate.of(9999, 1, 1));
        assertThat(RangoMes.de(YearMonth.of(9999, 12)).desde()).isEqualTo(LocalDate.of(9999, 12, 1));
    }

    @Test
    void rechazaAniosFueraDe1a9999() {
        for (YearMonth mes : new YearMonth[] {YearMonth.of(0, 6), YearMonth.of(10000, 1)}) {
            assertThatThrownBy(() -> RangoMes.de(mes))
                    .isInstanceOfSatisfying(DatoInvalidoException.class, e -> {
                        assertThat(e.getCampo()).isEqualTo("mes");
                        assertThat(e.getMessage()).isEqualTo(RangoMes.MENSAJE_FUERA_DE_RANGO);
                    });
        }
    }
}
