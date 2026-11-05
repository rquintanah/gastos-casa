package com.rquintanah.gastoscasa.resumen;

import com.rquintanah.gastoscasa.categoria.CategoriaDto;
import java.math.BigDecimal;

/** Total y número de gastos de una categoría en un mes. */
public record ResumenCategoriaDto(CategoriaDto categoria, BigDecimal total, long cantidad) {
}
