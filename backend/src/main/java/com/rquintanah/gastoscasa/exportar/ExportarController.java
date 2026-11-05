package com.rquintanah.gastoscasa.exportar;

import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gastos/export")
public class ExportarController {

    private static final MediaType TEXT_CSV_UTF8 = new MediaType("text", "csv", StandardCharsets.UTF_8);

    private final ExportarService exportarService;

    public ExportarController(ExportarService exportarService) {
        this.exportarService = exportarService;
    }

    // Sin produces: así el 400 puede negociar application/problem+json aunque el Accept sea text/csv.
    @GetMapping
    public ResponseEntity<byte[]> exportar(@RequestParam(name = "mes", required = false) YearMonth mes) {
        ArchivoCsv archivo = exportarService.exportarMes(mes);
        return ResponseEntity.ok()
                .contentType(TEXT_CSV_UTF8)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(archivo.nombre()).build().toString())
                .cacheControl(CacheControl.noStore())
                .body(archivo.contenido());
    }
}
