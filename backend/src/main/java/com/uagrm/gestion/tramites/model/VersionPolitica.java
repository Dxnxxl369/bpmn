package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "versiones_politica")
public class VersionPolitica {
    @Id
    private String id;
    private String politicaNegocioId; 
    private String xmlContent;
    private int version;
    private String creadoPor;
    private LocalDateTime creadoEn;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPoliticaNegocioId() { return politicaNegocioId; }
    public void setPoliticaNegocioId(String politicaNegocioId) { this.politicaNegocioId = politicaNegocioId; }
    public String getXmlContent() { return xmlContent; }
    public void setXmlContent(String xmlContent) { this.xmlContent = xmlContent; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public String getCreadoPor() { return creadoPor; }
    public void setCreadoPor(String creadoPor) { this.creadoPor = creadoPor; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }
}
