package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;

@Data
@Document(collection = "macro_procesos_paso")
public class MacroProcesoPaso {
    @Id
    private String id;
    private String macroprocesoId;
    private String politicaOrigenId; 
    private String politicaDestinoId; 
    private String eventoSalidaId; 
    private boolean esInicial = false;
}
