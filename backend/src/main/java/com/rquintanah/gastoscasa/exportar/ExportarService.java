package com.rquintanah.gastoscasa.exportar;

import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import com.rquintanah.gastoscasa.gasto.GastoDto;
import com.rquintanah.gastoscasa.gasto.GastoRepository;
import com.rquintanah.gastoscasa.gasto.RangoMes;
import java.time.YearMonth;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ExportarService {

    private final GastoRepository gastos;

    public ExportarService(GastoRepository gastos) {
        this.gastos = gastos;
    }

    /** @throws DatoInvalidoException con campo "mes" si mes es null o su año está fuera de 1..9999. */
    public ArchivoCsv exportarMes(YearMonth mes) {
        if (mes == null) {
            throw new DatoInvalidoException("mes", RangoMes.MENSAJE_OBLIGATORIO);
        }
        RangoMes rango = RangoMes.de(mes);
        List<GastoDto> filas = gastos.buscarEntreFechasCronologico(rango.desde(), rango.hasta()).stream()
                .map(GastoDto::de)
                .toList();
        return new ArchivoCsv("gastos-" + mes + ".csv", CsvGastos.generar(filas));
    }
}
