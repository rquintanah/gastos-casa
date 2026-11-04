package com.rquintanah.gastoscasa.error;

/** Error de validación detectado en el servicio (no por Bean Validation). Se traduce a 400. */
public class DatoInvalidoException extends RuntimeException {

    private final String campo;

    public DatoInvalidoException(String campo, String mensaje) {
        super(mensaje);
        this.campo = campo;
    }

    public String getCampo() {
        return campo;
    }
}
