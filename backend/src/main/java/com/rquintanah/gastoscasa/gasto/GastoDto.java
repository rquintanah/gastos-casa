package com.rquintanah.gastoscasa.gasto;

import com.rquintanah.gastoscasa.categoria.CategoriaDto;
import java.math.BigDecimal;
import java.time.LocalDate;

public record GastoDto(Long id, LocalDate fecha, BigDecimal importe, CategoriaDto categoria, String nota) {

    public static GastoDto de(Gasto gasto) {
        return new GastoDto(
                gasto.getId(),
                gasto.getFecha(),
                gasto.getImporte(),
                CategoriaDto.de(gasto.getCategoria()),
                gasto.getNota());
    }
}
