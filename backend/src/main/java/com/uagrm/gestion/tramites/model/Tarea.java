package com.uagrm.gestion.tramites.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Representa una tarea específica dentro de un proceso BPMN.
 * Almacena el esquema del formulario generado por IA.
 */
@Data
@Document(collection = "tareas")
public class Tarea {
    @Id
    private String id;
    private String nombre;
    private String nodoId;
    private String laneId;
    private String politicaNegocioId;
    
    /**
     * Esquema JSON del formulario capturado por IA.
     */
    private String formularioSchema;

    public Tarea() {}

    public Tarea(String nombre, String nodoId, String laneId, String politicaNegocioId) {
        this.nombre = nombre;
        this.nodoId = nodoId;
        this.laneId = laneId;
        this.politicaNegocioId = politicaNegocioId;
    }
}
