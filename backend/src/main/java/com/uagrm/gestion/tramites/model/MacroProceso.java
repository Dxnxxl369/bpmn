package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Document(collection = "macro_procesos")
public class MacroProceso {
    @Id
    private String id;
    private String nombre;
    private String descripcion;
    private LocalDateTime fechaCreacion;
}
