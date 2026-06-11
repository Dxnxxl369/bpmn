package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "politicas_negocio")
public class PoliticaNegocio {
    @Id
    private String id;
    private String nombre;
    private String descripcion;
    private String xmlBpmn;
    private EstadoPolitica estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime ultimaModificacion;

    // Trazabilidad y ADN del Proceso (2do Parcial)
    private String origenTipo;        // PDF, PROMPT, VOZ
    private String origenContenido;   // Texto del prompt o fragmento del PDF
    private String documentoOrigenId; // Enlace al documento en S3/DMS

    public PoliticaNegocio() {
        this.fechaCreacion = LocalDateTime.now();
        this.ultimaModificacion = LocalDateTime.now();
        this.estado = EstadoPolitica.BORRADOR;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public String getXmlBpmn() { return xmlBpmn; }
    public void setXmlBpmn(String xmlBpmn) { this.xmlBpmn = xmlBpmn; }
    public EstadoPolitica getEstado() { return estado; }
    public void setEstado(EstadoPolitica estado) { this.estado = estado; }
    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }
    public LocalDateTime getUltimaModificacion() { return ultimaModificacion; }
    public void setUltimaModificacion(LocalDateTime ultimaModificacion) { this.ultimaModificacion = ultimaModificacion; }

    public String getOrigenTipo() { return origenTipo; }
    public void setOrigenTipo(String origenTipo) { this.origenTipo = origenTipo; }
    public String getOrigenContenido() { return origenContenido; }
    public void setOrigenContenido(String origenContenido) { this.origenContenido = origenContenido; }
    public String getDocumentoOrigenId() { return documentoOrigenId; }
    public void setDocumentoOrigenId(String documentoOrigenId) { this.documentoOrigenId = documentoOrigenId; }
}
