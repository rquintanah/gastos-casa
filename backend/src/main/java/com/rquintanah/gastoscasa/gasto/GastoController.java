package com.rquintanah.gastoscasa.gasto;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.YearMonth;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gastos")
public class GastoController {

    private final GastoService gastoService;

    public GastoController(GastoService gastoService) {
        this.gastoService = gastoService;
    }

    @GetMapping
    public List<GastoDto> listar(@RequestParam(name = "mes", required = false) YearMonth mes) {
        return gastoService.listar(mes);
    }

    @GetMapping("/{id}")
    public GastoDto obtener(@PathVariable Long id) {
        return gastoService.obtener(id);
    }

    @PostMapping
    public ResponseEntity<GastoDto> crear(@Valid @RequestBody GastoRequest datos) {
        GastoDto creado = gastoService.crear(datos);
        return ResponseEntity.created(URI.create("/api/gastos/" + creado.id())).body(creado);
    }

    @PutMapping("/{id}")
    public GastoDto actualizar(@PathVariable Long id, @Valid @RequestBody GastoRequest datos) {
        return gastoService.actualizar(id, datos);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> borrar(@PathVariable Long id) {
        gastoService.borrar(id);
        return ResponseEntity.noContent().build();
    }
}
