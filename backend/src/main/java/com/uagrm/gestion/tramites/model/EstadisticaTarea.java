package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Document(collection = "estadisticas_tarea")
public class EstadisticaTarea {
    @Id
    private String id;

    private String politicaNegocioId;
    private String taskDefinitionId;
    private String nodoNombre; 
    private String usuarioId; // ID del ejecutivo
    private String usuarioNombre; 
    private String laneId;
    private Long duracionSegundos;
    private Long esperaSegundos; // Cuello de botella
    private Long ejecucionSegundos; // Eficiencia
    private LocalDateTime fechaRegistro;
}
