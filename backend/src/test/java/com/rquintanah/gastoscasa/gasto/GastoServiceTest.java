package com.rquintanah.gastoscasa.gasto;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.rquintanah.gastoscasa.categoria.CategoriaRepository;
import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import com.rquintanah.gastoscasa.error.RecursoNoEncontradoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GastoServiceTest {

    @Mock
    private GastoRepository gastos;

    @Mock
    private CategoriaRepository categorias;

    @InjectMocks
    private GastoService servicio;

    @Test
    void noGuardaSiLaCategoriaNoExiste() {
        when(categorias.findById((short) 99)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.crear(
                        new GastoRequest(LocalDate.now(), BigDecimal.TEN, (short) 99, null)))
                .isInstanceOf(DatoInvalidoException.class)
                .hasMessageContaining("99");
        verify(gastos, never()).save(any());
    }

    @Test
    void borrarUnGastoInexistenteLanzaNoEncontrado() {
        when(gastos.findWithCategoriaById(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.borrar(7L)).isInstanceOf(RecursoNoEncontradoException.class);
        verify(gastos, never()).delete(any());
    }
}
