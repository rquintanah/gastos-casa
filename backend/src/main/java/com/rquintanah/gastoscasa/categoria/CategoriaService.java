package com.rquintanah.gastoscasa.categoria;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CategoriaService {

    private final CategoriaRepository categorias;

    public CategoriaService(CategoriaRepository categorias) {
        this.categorias = categorias;
    }

    public List<CategoriaDto> listar() {
        return categorias.findAllByOrderByNombreAsc().stream().map(CategoriaDto::de).toList();
    }
}
