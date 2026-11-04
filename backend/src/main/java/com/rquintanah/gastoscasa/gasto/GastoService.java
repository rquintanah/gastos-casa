package com.rquintanah.gastoscasa.gasto;

import com.rquintanah.gastoscasa.categoria.Categoria;
import com.rquintanah.gastoscasa.categoria.CategoriaRepository;
import com.rquintanah.gastoscasa.error.DatoInvalidoException;
import com.rquintanah.gastoscasa.error.RecursoNoEncontradoException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GastoService {

    private final GastoRepository gastos;
    private final CategoriaRepository categorias;

    public GastoService(GastoRepository gastos, CategoriaRepository categorias) {
        this.gastos = gastos;
        this.categorias = categorias;
    }

    public List<GastoDto> listar() {
        return gastos.findAllByOrderByFechaDescIdDesc().stream().map(GastoDto::de).toList();
    }

    public GastoDto obtener(Long id) {
        return GastoDto.de(buscar(id));
    }

    @Transactional
    public GastoDto crear(GastoRequest datos) {
        Gasto gasto = new Gasto(datos.fecha(), importe(datos.importe()), categoria(datos.categoriaId()), notaLimpia(datos.nota()));
        return GastoDto.de(gastos.save(gasto));
    }

    @Transactional
    public GastoDto actualizar(Long id, GastoRequest datos) {
        Gasto gasto = buscar(id);
        gasto.actualizar(datos.fecha(), importe(datos.importe()), categoria(datos.categoriaId()), notaLimpia(datos.nota()));
        return GastoDto.de(gasto);
    }

    @Transactional
    public void borrar(Long id) {
        gastos.delete(buscar(id));
    }

    private Gasto buscar(Long id) {
        return gastos.findWithCategoriaById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el gasto " + id));
    }

    private Categoria categoria(Short id) {
        return categorias.findById(id)
                .orElseThrow(() -> new DatoInvalidoException("categoriaId", "La categoría " + id + " no existe"));
    }

    /** Siempre 2 decimales, como NUMERIC(12,2): 45.5 → 45.50. @Digits ya garantiza que no hay más de 2. */
    private static BigDecimal importe(BigDecimal importe) {
        return importe.setScale(2, RoundingMode.UNNECESSARY);
    }

    /** Nota vacía o solo espacios se guarda como null. */
    private static String notaLimpia(String nota) {
        return nota == null || nota.isBlank() ? null : nota.strip();
    }
}
