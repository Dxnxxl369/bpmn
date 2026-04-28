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
}
