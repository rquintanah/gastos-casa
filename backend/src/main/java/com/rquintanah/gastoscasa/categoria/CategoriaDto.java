package com.rquintanah.gastoscasa.categoria;

public record CategoriaDto(Short id, String nombre) {

    public static CategoriaDto de(Categoria categoria) {
        return new CategoriaDto(categoria.getId(), categoria.getNombre());
    }
}
