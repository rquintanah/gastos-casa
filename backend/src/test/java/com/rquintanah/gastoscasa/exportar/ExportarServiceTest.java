package com.rquintanah.gastoscasa.exportar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.rquintanah.gastoscasa.categoria.Categoria;
import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import com.rquintanah.gastoscasa.gasto.Gasto;
import com.rquintanah.gastoscasa.gasto.GastoRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ExportarServiceTest {

    @Mock
    private GastoRepository repositorio;

    @InjectMocks
    private ExportarService servicio;

    @Test
    void mesNuloLanzaDatoInvalidoSinConsultar() {
        assertThatThrownBy(() -> servicio.exportarMes(null))
                .isInstanceOfSatisfying(DatoInvalidoException.class, e -> {
                    assertThat(e.getCampo()).isEqualTo("mes");
                    assertThat(e.getMessage()).isEqualTo("El mes es obligatorio");
                });
        verifyNoInteractions(repositorio);
    }

    @Test
    void anioFueraDeRangoLanzaDatoInvalido() {
        assertThatThrownBy(() -> servicio.exportarMes(YearMonth.of(10000, 1)))
                .isInstanceOf(DatoInvalidoException.class);
        verifyNoInteractions(repositorio);
    }

    @Test
    void consultaElRangoDelMesYDevuelveNombreYContenido() {
        Categoria comida = org.mockito.Mockito.mock(Categoria.class);
        when(comida.getId()).thenReturn((short) 2);
        when(comida.getNombre()).thenReturn("Comida");
        when(repositorio.buscarEntreFechasCronologico(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1)))
                .thenReturn(List.of(new Gasto(LocalDate.of(2026, 11, 2), new BigDecimal("45.5"), comida, "pan")));

        ArchivoCsv archivo = servicio.exportarMes(YearMonth.of(2026, 11));

        assertThat(archivo.nombre()).isEqualTo("gastos-2026-11.csv");
        assertThat(new String(archivo.contenido(), StandardCharsets.UTF_8))
                .isEqualTo("﻿fecha;categoria;importe;nota\r\n2026-11-02;Comida;45.50;pan\r\n");
    }

    @Test
    void mesSinGastosDevuelveSoloCabecera() {
        when(repositorio.buscarEntreFechasCronologico(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 1)))
                .thenReturn(List.of());

        ArchivoCsv archivo = servicio.exportarMes(YearMonth.of(2026, 1));

        assertThat(archivo.nombre()).isEqualTo("gastos-2026-01.csv");
        assertThat(new String(archivo.contenido(), StandardCharsets.UTF_8))
                .isEqualTo("﻿fecha;categoria;importe;nota\r\n");
    }
}
