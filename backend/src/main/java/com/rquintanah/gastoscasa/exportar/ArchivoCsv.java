package com.rquintanah.gastoscasa.exportar;

/** Archivo CSV listo para descargar: nombre sugerido y bytes (UTF-8 con BOM). */
public record ArchivoCsv(String nombre, byte[] contenido) {}
