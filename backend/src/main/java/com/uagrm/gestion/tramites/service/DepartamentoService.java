package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.Departamento;
import com.uagrm.gestion.tramites.repository.DepartamentoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DepartamentoService {

    private final DepartamentoRepository repository;
    private final AuditoriaService auditoriaService;

    public List<Departamento> listarTodos() {
        return repository.findAll();
    }

    public Departamento guardar(Departamento d) {
        String accion;
        String detalles;
        
        if (d.getId() != null && !d.getId().trim().isEmpty()) {
            accion = "RENOMBRAR_DEPARTAMENTO";
            Departamento actual = repository.findById(d.getId()).orElseThrow();
            detalles = "De: " + actual.getNombreOriginal() + " -> A: " + d.getNombreOriginal();
        } else {
            accion = "CREAR_DEPARTAMENTO";
            detalles = "Nuevo departamento: " + d.getNombreOriginal();
        }
        
        Departamento saved = repository.save(d);
        auditoriaService.registrar(null, null, accion, "DEPARTAMENTOS", saved.getId(), detalles);
        return saved;
    }

    /**
     * Algoritmo de Inteligencia Departamental.
     * Normaliza el nombre del carril y busca similitudes para evitar duplicados.
     */
    public String resolverDepartamentoReal(String laneName) {
        if (laneName == null || laneName.trim().isEmpty()) {
            return "GENERAL";
        }
        
        String normalizado = normalizarTexto(laneName);
        
        // 1. Buscar coincidencia exacta por nombre normalizado
        List<Departamento> existentes = repository.findAll();
        for (Departamento d : existentes) {
            if (normalizarTexto(d.getNombreNormalizado()).equals(normalizado) || 
                normalizarTexto(d.getNombreOriginal()).equals(normalizado)) {
                return d.getNombreNormalizado();
            }
            
            // 2. Inteligencia de Similitud (Si se parecen más de un 80%)
            if (calcularSimilitud(normalizado, normalizarTexto(d.getNombreNormalizado())) > 0.8) {
                System.out.println("DEBUG: Similitud detectada entre '" + laneName + "' y '" + d.getNombreNormalizado() + "'");
                return d.getNombreNormalizado();
            }
        }

        // 3. Si no existe nada parecido, crear nuevo
        Departamento nuevo = new Departamento();
        nuevo.setNombreOriginal(laneName);
        nuevo.setNombreNormalizado(normalizado); // Usar el texto procesado, no el crudo
        return repository.save(nuevo).getNombreNormalizado();
    }

    private String normalizarTexto(String t) {
        if (t == null) return "";
        return t.toLowerCase()
                .replace("á", "a").replace("é", "e").replace("í", "i")
                .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
                .replaceAll("[^a-z0-9 ]", "").trim();
    }

    /**
     * Implementación del Algoritmo de Levenshtein para medir similitud.
     */
    private double calcularSimilitud(String s1, String s2) {
        if (s1.equals(s2)) return 1.0;
        int longerLength = Math.max(s1.length(), s2.length());
        if (longerLength == 0) return 1.0;
        return (longerLength - editDistance(s1, s2)) / (double) longerLength;
    }

    private int editDistance(String s1, String s2) {
        int[] costs = new int[s2.length() + 1];
        for (int i = 0; i <= s1.length(); i++) {
            int lastValue = i;
            for (int j = 0; j <= s2.length(); j++) {
                if (i == 0) costs[j] = j;
                else {
                    if (j > 0) {
                        int newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length()] = lastValue;
        }
        return costs[s2.length()];
    }

    public void eliminar(String id) {
        repository.deleteById(id);
    }
}
