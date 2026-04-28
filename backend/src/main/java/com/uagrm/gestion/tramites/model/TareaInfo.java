package com.uagrm.gestion.tramites.model;

import java.util.List;
import java.util.ArrayList;

public class TareaInfo {
    private String id;
    private String nombre;
    private String lane;
    private boolean tieneFormulario;
    private String estadoFormulario;
    
    // NUEVOS CAMPOS PARA LOGICA DE GATEWAY
    private boolean esPuntoDecision;
    private List<DecisionBranch> ramas = new ArrayList<>();

    public TareaInfo() {}

    public TareaInfo(String id, String nombre, String lane, boolean tieneFormulario, String estadoFormulario) {
        this.id = id;
        this.nombre = nombre;
        this.lane = lane;
        this.tieneFormulario = tieneFormulario;
        this.estadoFormulario = estadoFormulario;
    }

    // Getters y Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getLane() { return lane; }
    public void setLane(String lane) { this.lane = lane; }
    public boolean isTieneFormulario() { return tieneFormulario; }
    public void setTieneFormulario(boolean tieneFormulario) { this.tieneFormulario = tieneFormulario; }
    public String getEstadoFormulario() { return estadoFormulario; }
    public void setEstadoFormulario(String estadoFormulario) { this.estadoFormulario = estadoFormulario; }
    public boolean isEsPuntoDecision() { return esPuntoDecision; }
    public void setEsPuntoDecision(boolean esPuntoDecision) { this.esPuntoDecision = esPuntoDecision; }
    public List<DecisionBranch> getRamas() { return ramas; }
    public void setRamas(List<DecisionBranch> ramas) { this.ramas = ramas; }

    public static class DecisionBranch {
        private String condicion;
        private String destinoNombre;

        public DecisionBranch(String condicion, String destinoNombre) {
            this.condicion = condicion;
            this.destinoNombre = destinoNombre;
        }
        public String getCondicion() { return condicion; }
        public String getDestinoNombre() { return destinoNombre; }
    }
}
