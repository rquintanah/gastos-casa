package com.rquintanah.gastoscasa.gasto;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GastoRepository extends JpaRepository<Gasto, Long> {

    /** Todos los gastos, del más reciente al más antiguo, con su categoría en la misma consulta. */
    @EntityGraph(attributePaths = "categoria")
    List<Gasto> findAllByOrderByFechaDescIdDesc();

    /** Gastos con fecha en [desde, hasta), del más reciente al más antiguo. */
    @EntityGraph(attributePaths = "categoria")
    @Query("select g from Gasto g where g.fecha >= :desde and g.fecha < :hasta order by g.fecha desc, g.id desc")
    List<Gasto> buscarEntreFechas(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);

    /** Gastos con fecha en [desde, hasta), en orden cronológico (para exportar). */
    @EntityGraph(attributePaths = "categoria")
    @Query("select g from Gasto g where g.fecha >= :desde and g.fecha < :hasta order by g.fecha asc, g.id asc")
    List<Gasto> buscarEntreFechasCronologico(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);

    @EntityGraph(attributePaths = "categoria")
    Optional<Gasto> findWithCategoriaById(Long id);
}
