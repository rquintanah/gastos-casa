package com.rquintanah.gastoscasa.resumen;

import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import com.rquintanah.gastoscasa.gasto.RangoMes;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ResumenService {

    public static final String MENSAJE_MES_OBLIGATORIO = "El mes es obligatorio";

    private final ResumenRepository resumenes;

    public ResumenService(ResumenRepository resumenes) {
        this.resumenes = resumenes;
    }

    /** @throws DatoInvalidoException con campo "mes" si mes es null o su año está fuera de 1..9999. */
    public List<ResumenCategoriaDto> resumir(YearMonth mes) {
        if (mes == null) {
            throw new DatoInvalidoException("mes", MENSAJE_MES_OBLIGATORIO);
        }
        RangoMes rango = RangoMes.de(mes);
        return resumenes.resumirEntreFechas(rango.desde(), rango.hasta()).stream()
                .map(fila -> new ResumenCategoriaDto(
                        fila.categoria(), fila.total().setScale(2, RoundingMode.UNNECESSARY), fila.cantidad()))
                .toList();
    }
}
