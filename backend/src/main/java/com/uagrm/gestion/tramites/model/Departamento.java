package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "departamentos")
public class Departamento {
    @Id
    private String id;
    private String nombreOriginal; 
    private String nombreNormalizado; 

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNombreOriginal() { return nombreOriginal; }
    public void setNombreOriginal(String nombreOriginal) { this.nombreOriginal = nombreOriginal; }
    public String getNombreNormalizado() { return nombreNormalizado; }
    public void setNombreNormalizado(String nombreNormalizado) { this.nombreNormalizado = nombreNormalizado; }
}
