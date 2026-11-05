package com.rquintanah.gastoscasa.resumen;

import com.rquintanah.gastoscasa.gasto.Gasto;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Consultas agregadas de solo lectura sobre los gastos. */
public interface ResumenRepository extends Repository<Gasto, Long> {

    /** Una fila por categoría con gastos en [desde, hasta). Orden: total desc, nombre asc. */
    @Query("""
            select new com.rquintanah.gastoscasa.resumen.ResumenCategoriaDto(
                     new com.rquintanah.gastoscasa.categoria.CategoriaDto(c.id, c.nombre), sum(g.importe), count(g))
            from Gasto g join g.categoria c
            where g.fecha >= :desde and g.fecha < :hasta
            group by c.id, c.nombre
            order by sum(g.importe) desc, c.nombre asc""")
    List<ResumenCategoriaDto> resumirEntreFechas(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);
}
