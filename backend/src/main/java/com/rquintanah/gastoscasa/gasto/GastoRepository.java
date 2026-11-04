package com.rquintanah.gastoscasa.gasto;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GastoRepository extends JpaRepository<Gasto, Long> {

    /** Todos los gastos, del más reciente al más antiguo, con su categoría en la misma consulta. */
    @EntityGraph(attributePaths = "categoria")
    List<Gasto> findAllByOrderByFechaDescIdDesc();

    @EntityGraph(attributePaths = "categoria")
    Optional<Gasto> findWithCategoriaById(Long id);
}
