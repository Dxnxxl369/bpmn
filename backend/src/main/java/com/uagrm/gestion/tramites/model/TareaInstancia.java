package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "tareas_instancia")
public class TareaInstancia {
    @Id
    private String id;
    private String instanciaProcesoId;
    private String politicaNegocioId;
    private String taskDefinitionId; 
    private String nombre; 
    private String laneId; 
    private String estado; 
    private String solicitanteNombre;
    private String usuarioId; // Quién atendió la tarea
    private Instant fechaInicio; 
    private Instant fechaAtencion; // Momento en que el ejecutivo dio click en 'Atender'
    private Instant fechaCompletado;
    private String respuestasJson;

    public String getUsuarioId() { return usuarioId; }
    public void setUsuarioId(String usuarioId) { this.usuarioId = usuarioId; }
    public Instant getFechaAtencion() { return fechaAtencion; }
    public void setFechaAtencion(Instant fechaAtencion) { this.fechaAtencion = fechaAtencion; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getInstanciaProcesoId() { return instanciaProcesoId; }
    public void setInstanciaProcesoId(String instanciaProcesoId) { this.instanciaProcesoId = instanciaProcesoId; }
    public String getPoliticaNegocioId() { return politicaNegocioId; }
    public void setPoliticaNegocioId(String politicaNegocioId) { this.politicaNegocioId = politicaNegocioId; }
    public String getTaskDefinitionId() { return taskDefinitionId; }
    public void setTaskDefinitionId(String taskDefinitionId) { this.taskDefinitionId = taskDefinitionId; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getLaneId() { return laneId; }
    public void setLaneId(String laneId) { this.laneId = laneId; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getSolicitanteNombre() { return solicitanteNombre; }
    public void setSolicitanteNombre(String solicitanteNombre) { this.solicitanteNombre = solicitanteNombre; }
    public Instant getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(Instant fechaInicio) { this.fechaInicio = fechaInicio; }
    public Instant getFechaCompletado() { return fechaCompletado; }
    public void setFechaCompletado(Instant fechaCompletado) { this.fechaCompletado = fechaCompletado; }
    public String getRespuestasJson() { return respuestasJson; }
    public void setRespuestasJson(String respuestasJson) { this.respuestasJson = respuestasJson; }

    public String getNodoId() { return this.taskDefinitionId; }
    public String getNodoNombre() { return this.nombre; }
}
