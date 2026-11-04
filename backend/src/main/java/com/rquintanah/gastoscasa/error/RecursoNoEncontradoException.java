package com.rquintanah.gastoscasa.error;

/** Se traduce a 404 en {@link ManejadorErrores}. */
public class RecursoNoEncontradoException extends RuntimeException {

    public RecursoNoEncontradoException(String mensaje) {
        super(mensaje);
    }
}
