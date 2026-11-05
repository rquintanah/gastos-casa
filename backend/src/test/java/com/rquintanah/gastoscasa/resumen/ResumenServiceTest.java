package com.rquintanah.gastoscasa.resumen;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.rquintanah.gastoscasa.categoria.CategoriaDto;
import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ResumenServiceTest {

    @Mock
    private ResumenRepository repositorio;

    @InjectMocks
    private ResumenService servicio;

    @Test
    void mesNuloLanzaDatoInvalidoSinConsultar() {
        assertThatThrownBy(() -> servicio.resumir(null))
                .isInstanceOfSatisfying(DatoInvalidoException.class, e -> {
                    assertThat(e.getCampo()).isEqualTo("mes");
                    assertThat(e.getMessage()).isEqualTo("El mes es obligatorio");
                });
        verifyNoInteractions(repositorio);
    }

    @Test
    void anioFueraDeRangoLanzaDatoInvalido() {
        assertThatThrownBy(() -> servicio.resumir(YearMonth.of(10000, 1)))
                .isInstanceOf(DatoInvalidoException.class);
        verifyNoInteractions(repositorio);
    }

    @Test
    void consultaElRangoDelMesYNormalizaElTotalADosDecimales() {
        CategoriaDto comida = new CategoriaDto((short) 2, "Comida");
        CategoriaDto ocio = new CategoriaDto((short) 5, "Ocio");
        when(repositorio.resumirEntreFechas(LocalDate.of(2026, 2, 1), LocalDate.of(2026, 3, 1)))
                .thenReturn(List.of(
                        new ResumenCategoriaDto(comida, new BigDecimal("80.0"), 3),
                        new ResumenCategoriaDto(ocio, new BigDecimal("80"), 1)));

        List<ResumenCategoriaDto> resultado = servicio.resumir(YearMonth.of(2026, 2));

        assertThat(resultado).extracting(ResumenCategoriaDto::categoria).containsExactly(comida, ocio);
        assertThat(resultado).extracting(r -> r.total().toPlainString()).containsExactly("80.00", "80.00");
        assertThat(resultado).extracting(ResumenCategoriaDto::cantidad).containsExactly(3L, 1L);
    }

    @Test
    void sinGastosDevuelveListaVacia() {
        when(repositorio.resumirEntreFechas(any(), any())).thenReturn(List.of());

        assertThat(servicio.resumir(YearMonth.of(2026, 2))).isEmpty();
    }
}
