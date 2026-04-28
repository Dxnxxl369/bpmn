package com.uagrm.gestion.tramites.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "linked_tasks")
public class LinkedTask {
    @Id
    private String id;
    private String processInstanceId; // El ID del trámite (token)
    private String userId;           // El ID del usuario que lo vinculó
    private String verificador;      // El dato que se usó para validar (ej. correo)
}
