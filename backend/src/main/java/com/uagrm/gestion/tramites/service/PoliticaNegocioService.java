package com.uagrm.gestion.tramites.service;

import com.uagrm.gestion.tramites.model.PoliticaNegocio;
import com.uagrm.gestion.tramites.model.VersionPolitica;
import com.uagrm.gestion.tramites.model.EstadoPolitica;
import com.uagrm.gestion.tramites.model.TareaInfo;
import com.uagrm.gestion.tramites.model.Departamento;
import com.uagrm.gestion.tramites.repository.PoliticaNegocioRepository;
import com.uagrm.gestion.tramites.repository.VersionPoliticaRepository;
import com.uagrm.gestion.tramites.repository.DepartamentoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PoliticaNegocioService {

    private final PoliticaNegocioRepository repository;
    private final VersionPoliticaRepository versionRepository;
    private final DepartamentoRepository departamentoRepository;

    public List<PoliticaNegocio> listarTodas() { return repository.findAll(); }
    public List<PoliticaNegocio> listarPorEstado(EstadoPolitica estado) { return repository.findByEstado(estado); }
    public Optional<PoliticaNegocio> obtenerPorId(String id) { return repository.findById(id); }

    public PoliticaNegocio crear(PoliticaNegocio p) {
        p.setFechaCreacion(LocalDateTime.now());
        p.setUltimaModificacion(LocalDateTime.now());
        p.setEstado(EstadoPolitica.BORRADOR);
        return repository.save(p);
    }

    public PoliticaNegocio guardarOActualizar(PoliticaNegocio p) {
        p.setUltimaModificacion(LocalDateTime.now());
        return repository.save(p);
    }

    public String obtenerLaneDeTarea(String politicaId, String taskId) {
        List<TareaInfo> tareas = extraerTareasUsuario(politicaId);
        return tareas.stream()
                .filter(t -> t.getId().equalsIgnoreCase(taskId))
                .map(TareaInfo::getLane)
                .findFirst()
                .orElse("GENERAL");
    }

    public Map<String, Object> activarPolitica(String id) {
        PoliticaNegocio p = repository.findById(id).orElseThrow();
        p.setEstado(EstadoPolitica.ACTIVA);
        p.setUltimaModificacion(LocalDateTime.now());
        repository.save(p);

        // Lógica de Sincronización de Departamentos (La IA del proceso)
        return sincronizarDepartamentosDesdeXml(p.getXmlBpmn());
    }

    private Map<String, Object> sincronizarDepartamentosDesdeXml(String xml) {
        int total = 0;
        int creados = 0;
        int vinculados = 0;

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

            NodeList lanes = doc.getElementsByTagNameNS("*", "lane");
            total = lanes.getLength();

            for (int i = 0; i < lanes.getLength(); i++) {
                Element lane = (Element) lanes.item(i);
                String name = lane.getAttribute("name");
                if (name == null || name.isBlank()) continue;

                Optional<Departamento> exist = departamentoRepository.findByNombreOriginal(name);
                if (exist.isEmpty()) {
                    Departamento d = new Departamento();
                    d.setNombreOriginal(name);
                    d.setNombreNormalizado(name.toUpperCase().trim());
                    departamentoRepository.save(d);
                    creados++;
                } else {
                    vinculados++;
                }
            }
        } catch (Exception e) {
            log.error("Error sincronizando departamentos", e);
        }

        Map<String, Object> report = new HashMap<>();
        report.put("total", total);
        report.put("creados", creados);
        report.put("vinculados", vinculados);
        report.put("hasSimilar", false);
        
        return Map.of("status", "success", "report", report);
    }

    public PoliticaNegocio archivarPolitica(String id) {
        PoliticaNegocio p = repository.findById(id).orElseThrow();
        p.setEstado(EstadoPolitica.BORRADOR);
        p.setUltimaModificacion(LocalDateTime.now());
        return repository.save(p);
    }

    public void actualizarXml(String id, String xml) {
        PoliticaNegocio p = repository.findById(id).orElseThrow();
        p.setXmlBpmn(xml);
        p.setUltimaModificacion(LocalDateTime.now());
        repository.save(p);

        // CREAR VERSIÓN AUTOMÁTICA PARA SINCRONIZACIÓN Y AUDITORÍA
        VersionPolitica v = new VersionPolitica();
        v.setPoliticaNegocioId(id);
        v.setXmlContent(xml);
        v.setCreadoEn(LocalDateTime.now());
        
        // Calcular número de versión
        VersionPolitica ultima = versionRepository.findFirstByPoliticaNegocioIdOrderByVersionDesc(id);
        v.setVersion(ultima != null ? ultima.getVersion() + 1 : 1);
        v.setCreadoPor("SISTEMA_AUTO");
        
        versionRepository.save(v);
    }

    public Map<String, Object> resincronizarTodo() {
        List<PoliticaNegocio> activas = repository.findByEstado(EstadoPolitica.ACTIVA);
        for(PoliticaNegocio p : activas) {
            sincronizarDepartamentosDesdeXml(p.getXmlBpmn());
        }
        return Map.of("message", "Resincronización de todos los procesos completada");
    }

    public List<VersionPolitica> listarVersiones(String id) {
        return versionRepository.findByPoliticaNegocioIdOrderByVersionDesc(id);
    }

    public PoliticaNegocio restaurarVersion(String id, String versionId) {
        VersionPolitica v = versionRepository.findById(versionId).orElseThrow();
        PoliticaNegocio p = repository.findById(id).orElseThrow();
        p.setXmlBpmn(v.getXmlContent());
        p.setUltimaModificacion(LocalDateTime.now());
        return repository.save(p);
    }

    public List<TareaInfo> extraerTareasUsuario(String id) {
        List<TareaInfo> tareas = new ArrayList<>();
        Optional<PoliticaNegocio> p = repository.findById(id);
        if (p.isEmpty() || p.get().getXmlBpmn() == null) return tareas;

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(p.get().getXmlBpmn().getBytes(StandardCharsets.UTF_8)));

            Map<String, String> laneMap = new HashMap<>();
            NodeList lanes = doc.getElementsByTagNameNS("*", "lane");
            for (int i = 0; i < lanes.getLength(); i++) {
                Element lane = (Element) lanes.item(i);
                String laneId = lane.getAttribute("id");
                String laneName = lane.getAttribute("name");
                
                if (laneName == null || laneName.isEmpty()) laneName = "Departamento sin nombre";
                
                laneMap.put(laneId, laneName);

                NodeList flowNodeRefs = lane.getElementsByTagNameNS("*", "flowNodeRef");
                for (int j = 0; j < flowNodeRefs.getLength(); j++) {
                    String taskRef = flowNodeRefs.item(j).getTextContent().trim();
                    laneMap.put("TASK_REF_" + taskRef, laneName);
                }
            }

            NodeList userTasks = doc.getElementsByTagNameNS("*", "userTask");
            for (int i = 0; i < userTasks.getLength(); i++) {
                Element task = (Element) userTasks.item(i);
                String taskId = task.getAttribute("id");
                String taskName = task.getAttribute("name");
                
                String laneName = laneMap.get("TASK_REF_" + taskId);
                if (laneName == null) laneName = "Atención General";

                TareaInfo info = new TareaInfo(taskId, taskName, laneName, false, "VACIO");
                
                // DETECTAR LOGICA DE DECISION (GATEWAY)
                buscarGatewaySiguiente(doc, taskId, info);

                tareas.add(info);
            }
        } catch (Exception e) {
            log.error("Error extrayendo tareas del XML", e);
        }
        return tareas;
    }

    private void buscarGatewaySiguiente(Document doc, String taskId, TareaInfo info) {
        try {
            // 1. Buscar flujo que sale de la tarea
            NodeList sequences = doc.getElementsByTagNameNS("*", "sequenceFlow");
            String gatewayId = null;
            
            for (int i = 0; i < sequences.getLength(); i++) {
                Element flow = (Element) sequences.item(i);
                if (flow.getAttribute("sourceRef").equals(taskId)) {
                    String targetId = flow.getAttribute("targetRef");
                    // 2. ¿El destino es un gateway?
                    if (targetId.toLowerCase().contains("gateway")) {
                        gatewayId = targetId;
                        break;
                    }
                }
            }

            if (gatewayId != null) {
                info.setEsPuntoDecision(true);
                // 3. Buscar ramas del gateway
                for (int i = 0; i < sequences.getLength(); i++) {
                    Element flow = (Element) sequences.item(i);
                    if (flow.getAttribute("sourceRef").equals(gatewayId)) {
                        String condicion = flow.getAttribute("name");
                        String targetRef = flow.getAttribute("targetRef");
                        
                        // Buscar el nombre del destino (tarea)
                        String destinoNombre = "Fin del Proceso";
                        NodeList allNodes = doc.getDocumentElement().getElementsByTagName("*");
                        for (int j = 0; j < allNodes.getLength(); j++) {
                            Element node = (Element) allNodes.item(j);
                            if (node.getAttribute("id").equals(targetRef)) {
                                destinoNombre = node.getAttribute("name");
                                break;
                            }
                        }
                        
                        if (condicion == null || condicion.isEmpty()) condicion = "Continuar";
                        info.getRamas().add(new TareaInfo.DecisionBranch(condicion, destinoNombre));
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error detectando gateway", e);
        }
    }

    public void eliminar(String id) { repository.deleteById(id); }
}
