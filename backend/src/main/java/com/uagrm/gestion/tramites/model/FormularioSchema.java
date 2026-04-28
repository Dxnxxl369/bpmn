package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "formularios_schema")
public class FormularioSchema {
    @Id
    private String id;
    private String politicaId;
    private String taskDefinitionId; // Se guardará en minúsculas para evitar errores
    private String nombreTarea;
    private String laneId; // Vinculación directa con el departamento
    private String schemaJson;
    private String estado; // BORRADOR, LISTO

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPoliticaId() { return politicaId; }
    public void setPoliticaId(String politicaId) { this.politicaId = politicaId; }
    public String getTaskDefinitionId() { return taskDefinitionId; }
    public void setTaskDefinitionId(String taskDefinitionId) { 
        this.taskDefinitionId = taskDefinitionId != null ? taskDefinitionId.toLowerCase() : null; 
    }
    public String getNombreTarea() { return nombreTarea; }
    public void setNombreTarea(String nombreTarea) { this.nombreTarea = nombreTarea; }
    public String getLaneId() { return laneId; }
    public void setLaneId(String laneId) { this.laneId = laneId; }
    public String getSchemaJson() { return schemaJson; }
    public void setSchemaJson(String schemaJson) { this.schemaJson = schemaJson; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}
