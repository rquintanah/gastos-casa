package com.rquintanah.gastoscasa.categoria;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Categoría fija de gasto. Se carga por migración y no se edita desde la app. */
@Entity
@Table(name = "categoria")
public class Categoria {

    @Id
    private Short id;

    private String nombre;

    protected Categoria() {
        // requerido por JPA
    }

    public Short getId() {
        return id;
    }

    public String getNombre() {
        return nombre;
    }
}
