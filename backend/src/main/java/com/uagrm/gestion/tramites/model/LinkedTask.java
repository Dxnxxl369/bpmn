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
    private String processInstanceId; // El ID del trÃ¡mite (token)
    private String userId;           // El ID del usuario que lo vinculÃ³
    private String deviceToken;      // El token del dispositivo (para anÃ³nimos)
    private String verificador;      // El dato que se usÃ³ para validar (ej. correo)
}

