package com.rquintanah.gastoscasa.gasto;

import com.rquintanah.gastoscasa.categoria.Categoria;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "gasto")
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal importe;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    private Categoria categoria;

    @Column(length = 500)
    private String nota;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private Instant creadoEn;

    @UpdateTimestamp
    @Column(name = "actualizado_en", nullable = false)
    private Instant actualizadoEn;

    protected Gasto() {
        // requerido por JPA
    }

    public Gasto(LocalDate fecha, BigDecimal importe, Categoria categoria, String nota) {
        actualizar(fecha, importe, categoria, nota);
    }

    public final void actualizar(LocalDate fecha, BigDecimal importe, Categoria categoria, String nota) {
        this.fecha = fecha;
        this.importe = importe;
        this.categoria = categoria;
        this.nota = nota;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getFecha() {
        return fecha;
    }

    public BigDecimal getImporte() {
        return importe;
    }

    public Categoria getCategoria() {
        return categoria;
    }

    public String getNota() {
        return nota;
    }
}
