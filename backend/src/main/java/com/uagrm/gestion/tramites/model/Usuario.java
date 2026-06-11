package com.uagrm.gestion.tramites.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Set;
import java.util.HashSet;
import java.util.List;
import java.util.ArrayList;

@Document(collection = "usuarios")
public class Usuario {
    @Id
    private String id;
    private String nombre;
    private String apellido;
    private String username;
    private String email;
    private String passwordHash;
    private String ci; // CAMPO CRÃTICO PARA VINCULACIÃ“N
    private String celular; // NUEVO CAMPO
    private String rol;
    private String avatar;
    
    // ASIGNACIÓN MÚLTIPLE DE DEPARTAMENTOS
    private List<String> departamentoIds = new ArrayList<>();
    
    private String laneId;

    private Set<String> permisos = new HashSet<>();
    private String politicaNegocioId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getCi() { return ci; }
    public void setCi(String ci) { this.ci = ci; }
    public String getCelular() { return celular; }
    public void setCelular(String celular) { this.celular = celular; }
    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public List<String> getDepartamentoIds() { return departamentoIds; }
    public void setDepartamentoIds(List<String> departamentoIds) { this.departamentoIds = departamentoIds; }

    public String getLaneId() { return laneId; }
    public void setLaneId(String laneId) { this.laneId = laneId; }

    public Set<String> getPermisos() { return permisos; }
    public void setPermisos(Set<String> permisos) { this.permisos = permisos; }
    public String getPoliticaNegocioId() { return politicaNegocioId; }
    public void setPoliticaNegocioId(String politicaNegocioId) { this.politicaNegocioId = politicaNegocioId; }
}
