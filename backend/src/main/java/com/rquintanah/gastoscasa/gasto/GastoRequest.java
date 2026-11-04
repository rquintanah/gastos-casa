package com.rquintanah.gastoscasa.gasto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Datos para crear o editar un gasto. Importes en soles (PEN). */
public record GastoRequest(
        @NotNull(message = "La fecha es obligatoria")
        @PastOrPresent(message = "La fecha no puede ser futura")
        LocalDate fecha,

        @NotNull(message = "El importe es obligatorio")
        @DecimalMin(value = "0.01", message = "El importe debe ser mayor que 0")
        @Digits(integer = 10, fraction = 2, message = "El importe admite como máximo 10 enteros y 2 decimales")
        BigDecimal importe,

        @NotNull(message = "La categoría es obligatoria")
        Short categoriaId,

        @Size(max = 500, message = "La nota admite como máximo 500 caracteres")
        String nota) {
}
