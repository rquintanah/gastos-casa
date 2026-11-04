package com.rquintanah.gastoscasa.error;

import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Traduce las excepciones a respuestas ProblemDetail (RFC 9457). */
@RestControllerAdvice
public class ManejadorErrores extends ResponseEntityExceptionHandler {

    static final String TITULO_VALIDACION = "Datos inválidos";

    static final Map<Class<?>, String> MENSAJES_POR_TIPO = Map.of(
            YearMonth.class, "El mes debe tener el formato AAAA-MM, por ejemplo 2026-11");

    @Override
    protected ResponseEntity<Object> handleTypeMismatch(
            TypeMismatchException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        String campo = ex instanceof MethodArgumentTypeMismatchException m ? m.getName() : ex.getPropertyName();
        String mensaje = MENSAJES_POR_TIPO.getOrDefault(ex.getRequiredType(), "Valor no válido");
        return ResponseEntity.badRequest().body(problemaValidacion(Map.of(campo == null ? "valor" : campo, mensaje)));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> errores = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errores.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(problemaValidacion(errores));
    }

    @ExceptionHandler(DatoInvalidoException.class)
    ProblemDetail datoInvalido(DatoInvalidoException ex) {
        return problemaValidacion(Map.of(ex.getCampo(), ex.getMessage()));
    }

    @ExceptionHandler(RecursoNoEncontradoException.class)
    ProblemDetail noEncontrado(RecursoNoEncontradoException ex) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problema.setTitle("No encontrado");
        return problema;
    }

    private static ProblemDetail problemaValidacion(Map<String, String> errores) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Revisa los campos marcados en 'errores'.");
        problema.setTitle(TITULO_VALIDACION);
        problema.setProperty("errores", errores);
        return problema;
    }
}
