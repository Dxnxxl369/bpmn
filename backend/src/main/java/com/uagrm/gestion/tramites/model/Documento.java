package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document(collection = "documentos")
public class Documento {
    @Id
    private String id;
    private String clienteCi;
    private String instanciaId;
    private String nombreArchivo;
    private String tipoDocumento; // CI, TITULO_PROPIEDAD, FACTURA, etc.
    private String urlS3;
    private Instant fechaSubida;
    
    // Control de Versiones (2do Parcial)
    private Integer version;
    private Boolean esActual;
    private String documentoPadreId; // ID del primer documento de esta serie
    private String estadoDocumento; // PENDIENTE, APROBADO, OBSERVADO
    private String motivoObservacion; // Comentario del funcionario si se rechaza
    
    // Metadatos de Funcionario (Documentos Colaborativos)
    private String creadoPorFuncionarioId;
    private String funcionarioNombre;
    private String departamentoNombre;
    private Boolean esColaborativo;
    private String contenidoHtml; // Para documentos creados por funcionarios
    
    // Metadatos de OCR para resaltado visual
    private String ocrTexto;
    private List<OcrCoordinate> coordenadas;

    public static class OcrCoordinate {
        private String texto;
        private int x;
        private int y;
        private int w;
        private int h;

        public OcrCoordinate() {}
        public OcrCoordinate(String texto, int x, int y, int w, int h) {
            this.texto = texto;
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
        }

        public String getTexto() { return texto; }
        public void setTexto(String texto) { this.texto = texto; }
        public int getX() { return x; }
        public void setX(int x) { this.x = x; }
        public int getY() { return y; }
        public void setY(int y) { this.y = y; }
        public int getW() { return w; }
        public void setW(int w) { this.w = w; }
        public int getH() { return h; }
        public void setH(int h) { this.h = h; }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getClienteCi() { return clienteCi; }
    public void setClienteCi(String clienteCi) { this.clienteCi = clienteCi; }
    public String getInstanciaId() { return instanciaId; }
    public void setInstanciaId(String instanciaId) { this.instanciaId = instanciaId; }
    public String getNombreArchivo() { return nombreArchivo; }
    public void setNombreArchivo(String nombreArchivo) { this.nombreArchivo = nombreArchivo; }
    public String getTipoDocumento() { return tipoDocumento; }
    public void setTipoDocumento(String tipoDocumento) { this.tipoDocumento = tipoDocumento; }
    public String getUrlS3() { return urlS3; }
    public void setUrlS3(String urlS3) { this.urlS3 = urlS3; }
    public Instant getFechaSubida() { return fechaSubida; }
    public void setFechaSubida(Instant fechaSubida) { this.fechaSubida = fechaSubida; }
    public String getOcrTexto() { return ocrTexto; }
    public void setOcrTexto(String ocrTexto) { this.ocrTexto = ocrTexto; }
    public List<OcrCoordinate> getCoordenadas() { return coordenadas; }
    public void setCoordenadas(List<OcrCoordinate> coordenadas) { this.coordenadas = coordenadas; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public Boolean getEsActual() { return esActual; }
    public void setEsActual(Boolean esActual) { this.esActual = esActual; }
    public String getDocumentoPadreId() { return documentoPadreId; }
    public void setDocumentoPadreId(String documentoPadreId) { this.documentoPadreId = documentoPadreId; }

    public String getEstadoDocumento() { return estadoDocumento; }
    public void setEstadoDocumento(String estadoDocumento) { this.estadoDocumento = estadoDocumento; }
    public String getMotivoObservacion() { return motivoObservacion; }
    public void setMotivoObservacion(String motivoObservacion) { this.motivoObservacion = motivoObservacion; }

    public String getCreadoPorFuncionarioId() { return creadoPorFuncionarioId; }
    public void setCreadoPorFuncionarioId(String creadoPorFuncionarioId) { this.creadoPorFuncionarioId = creadoPorFuncionarioId; }
    public String getFuncionarioNombre() { return funcionarioNombre; }
    public void setFuncionarioNombre(String funcionarioNombre) { this.funcionarioNombre = funcionarioNombre; }
    public String getDepartamentoNombre() { return departamentoNombre; }
    public void setDepartamentoNombre(String departamentoNombre) { this.departamentoNombre = departamentoNombre; }
    public Boolean getEsColaborativo() { return esColaborativo; }
    public void setEsColaborativo(Boolean esColaborativo) { this.esColaborativo = esColaborativo; }
    public String getContenidoHtml() { return contenidoHtml; }
    public void setContenidoHtml(String contenidoHtml) { this.contenidoHtml = contenidoHtml; }
}
