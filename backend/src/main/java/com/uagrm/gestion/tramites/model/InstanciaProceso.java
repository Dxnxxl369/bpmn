package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "instancias_proceso")
public class InstanciaProceso {
    @Id
    private String id;
    private String politicaNegocioId; 
    private String xmlBpmn;
    private String estado; // EN_CURSO, FINALIZADO
    private String nodoActualId;
    private String laneId; 
    private String solicitanteNombre;
    private Instant fechaInicio;
    private Instant fechaFin;
    private String macroprocesoId;
    private String contextoJson; // Aquí viajan el Nombre, CI, Teléfono, etc.
    private String clienteCi; // Identificador maestro para el repositorio documental
    
    // Observaciones específicas por campo (para campos que no son archivos)
    private java.util.Map<String, String> observacionesCampos = new java.util.HashMap<>();
    
    // Seguimiento para el cliente
    private String codigoSeguimiento;
    private String resultadoFinal; // APROBADO (Verde), RECHAZADO (Rojo), EN_CURSO (Amarillo)

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPoliticaNegocioId() { return politicaNegocioId; }
    public void setPoliticaNegocioId(String politicaNegocioId) { this.politicaNegocioId = politicaNegocioId; }
    public String getXmlBpmn() { return xmlBpmn; }
    public void setXmlBpmn(String xmlBpmn) { this.xmlBpmn = xmlBpmn; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getNodoActualId() { return nodoActualId; }
    public void setNodoActualId(String nodoActualId) { this.nodoActualId = nodoActualId; }
    public String getLaneId() { return laneId; }
    public void setLaneId(String laneId) { this.laneId = laneId; }
    public String getSolicitanteNombre() { return solicitanteNombre; }
    public void setSolicitanteNombre(String solicitanteNombre) { this.solicitanteNombre = solicitanteNombre; }
    public Instant getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(Instant fechaInicio) { this.fechaInicio = fechaInicio; }
    public Instant getFechaFin() { return fechaFin; }
    public void setFechaFin(Instant fechaFin) { this.fechaFin = fechaFin; }
    public String getMacroprocesoId() { return macroprocesoId; }
    public void setMacroprocesoId(String macroprocesoId) { this.macroprocesoId = macroprocesoId; }
    public String getContextoJson() { return contextoJson; }
    public void setContextoJson(String contextoJson) { this.contextoJson = contextoJson; }
    public String getClienteCi() { return clienteCi; }
    public void setClienteCi(String clienteCi) { this.clienteCi = clienteCi; }
    public String getCodigoSeguimiento() { return codigoSeguimiento; }
    public void setCodigoSeguimiento(String codigoSeguimiento) { this.codigoSeguimiento = codigoSeguimiento; }
    public String getResultadoFinal() { return resultadoFinal; }
    public void setResultadoFinal(String resultadoFinal) { this.resultadoFinal = resultadoFinal; }

    public java.util.Map<String, String> getObservacionesCampos() { return observacionesCampos; }
    public void setObservacionesCampos(java.util.Map<String, String> observacionesCampos) { this.observacionesCampos = observacionesCampos; }
}
