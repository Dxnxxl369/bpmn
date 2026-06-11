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
import org.springframework.scheduling.annotation.Async;
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
    private final AuditoriaService auditoriaService;

    @Async
    public void actualizarXmlAsync(String id, String xml, String autor) {
        try {
            actualizarXml(id, xml, autor);
        } catch (Exception e) {
            log.error("Error asíncrono actualizando XML", e);
        }
    }

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

        auditoriaService.registrar(null, null, "PUBLICAR_PROCESO", "DISEÑADOR", id, "Proceso publicado: " + p.getNombre());

        // Lógica de Sincronización de Departamentos (UML 2.5 ActivityPartition)
        return sincronizarDepartamentosDesdeXml(p.getXmlBpmn());
    }

    private Map<String, Object> sincronizarDepartamentosDesdeXml(String xml) {
        int total = 0;
        int creados = 0;
        int vinculados = 0;

        // Diccionario de exclusión para actores externos
        List<String> excludedKeywords = List.of(
            "CLIENTE", "CIUDADANO", "SOLICITANTE", "PACIENTE", "ESTUDIANTE", "INTERESADO", "USUARIO", "EXTERNO"
        );

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

            // UML 2.5: Las calles son ActivityPartitions
            NodeList lanes = doc.getElementsByTagNameNS("*", "ActivityPartition");
            total = lanes.getLength();

            for (int i = 0; i < lanes.getLength(); i++) {
                Element lane = (Element) lanes.item(i);
                String name = lane.getAttribute("name");
                String isExternalAttr = lane.getAttribute("isExternal");
                
                if (name == null || name.isBlank()) continue;

                // Verificar si es un actor externo por atributo XML
                boolean isExternal = "true".equalsIgnoreCase(isExternalAttr);
                
                // Verificar si es un actor externo por diccionario semántico
                if (!isExternal) {
                    String nameUpper = name.toUpperCase().trim();
                    for (String keyword : excludedKeywords) {
                        if (nameUpper.contains(keyword)) {
                            isExternal = true;
                            break;
                        }
                    }
                }

                // Si es un actor externo, lo ignoramos para la creación de departamentos físicos
                if (isExternal) {
                    log.info("Actor externo detectado (ignorado para departamentos): {}", name);
                    continue;
                }

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
            log.error("Error sincronizando departamentos (UML)", e);
        }

        Map<String, Object> report = new HashMap<>();
        report.put("total", total);
        report.put("creados", creados);
        report.put("vinculados", vinculados);
        
        return Map.of("status", "success", "report", report);
    }

    public PoliticaNegocio archivarPolitica(String id) {
        PoliticaNegocio p = repository.findById(id).orElseThrow();
        p.setEstado(EstadoPolitica.BORRADOR);
        p.setUltimaModificacion(LocalDateTime.now());
        auditoriaService.registrar(null, null, "REVERTIR_A_BORRADOR", "DISEÑADOR", id, "Proceso devuelto a borradores: " + p.getNombre());
        return repository.save(p);
    }

    public void actualizarXml(String id, String xml, String autor) {
        PoliticaNegocio p = repository.findById(id).orElseThrow();
        p.setXmlBpmn(xml);
        p.setUltimaModificacion(LocalDateTime.now());
        repository.save(p);

        // NUNCA SINCRONIZAR DEPARTAMENTOS AQUÍ. Solo se hace en activarPolitica().
        
        VersionPolitica v = new VersionPolitica();
        v.setPoliticaNegocioId(id);
        v.setXmlContent(xml);
        v.setCreadoEn(LocalDateTime.now());
        v.setCreadoPor(autor != null ? autor : "SISTEMA_AUTO");
        
        VersionPolitica ultima = versionRepository.findFirstByPoliticaNegocioIdOrderByVersionDesc(id);
        v.setVersion(ultima != null ? ultima.getVersion() + 1 : 1);
        
        versionRepository.save(v);
    }

    public List<VersionPolitica> listarVersiones(String id) {
        return versionRepository.findByPoliticaNegocioIdOrderByVersionDesc(id);
    }

    public PoliticaNegocio restaurarVersion(String id, String versionId, String autor) {
        VersionPolitica vToRestore = versionRepository.findById(versionId).orElseThrow();
        
        String tag = "RESTAURADA de v" + vToRestore.getVersion();
        String finalAutor = (autor != null ? autor : "SISTEMA") + " (" + tag + ")";
        
        actualizarXml(id, vToRestore.getXmlContent(), finalAutor);
        
        return repository.findById(id).orElseThrow();
    }

    public Map<String, Object> resincronizarTodo() {
        List<PoliticaNegocio> activas = repository.findByEstado(EstadoPolitica.ACTIVA);
        for(PoliticaNegocio p : activas) {
            sincronizarDepartamentosDesdeXml(p.getXmlBpmn());
        }
        return Map.of("message", "Resincronización de todos los procesos completada");
    }

    public void eliminar(String id) {
        repository.deleteById(id);
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

            // 1. Mapear qué nodos pertenecen a qué calle
            Map<String, String> laneMap = new HashMap<>();
            NodeList partitions = doc.getElementsByTagNameNS("*", "ActivityPartition");
            for (int i = 0; i < partitions.getLength(); i++) {
                Element partition = (Element) partitions.item(i);
                String laneName = partition.getAttribute("name");
                NodeList nodeRefs = partition.getElementsByTagNameNS("*", "nodeRef");
                for (int j = 0; j < nodeRefs.getLength(); j++) {
                    String taskRef = nodeRefs.item(j).getTextContent().trim();
                    laneMap.put(taskRef, laneName);
                }
            }

            // 2. Mapear los flujos (ControlFlow) -> Key: ID del flujo, Value: ID del nodo destino
            Map<String, String> flowTargetMap = new HashMap<>();
            NodeList controlFlows = doc.getElementsByTagNameNS("*", "ControlFlow");
            if (controlFlows.getLength() == 0) controlFlows = doc.getElementsByTagName("ControlFlow");
            for (int i = 0; i < controlFlows.getLength(); i++) {
                Element flow = (Element) controlFlows.item(i);
                flowTargetMap.put(flow.getAttribute("id"), flow.getAttribute("targetRef"));
            }

            // 3. Mapear todos los nodos por su ID y encontrar el Nodo Inicial
            Map<String, Element> allNodesMap = new HashMap<>();
            NodeList allNodes = doc.getElementsByTagName("*");
            Element initialNode = null;
            
            for (int i = 0; i < allNodes.getLength(); i++) {
                Element node = (Element) allNodes.item(i);
                String nodeId = node.getAttribute("id");
                if (nodeId != null && !nodeId.isEmpty()) {
                    allNodesMap.put(nodeId, node);
                    String tagName = node.getLocalName() != null ? node.getLocalName() : node.getTagName();
                    if (tagName.contains("InitialNode")) {
                        initialNode = node;
                    }
                }
            }

            if (initialNode == null) {
                log.warn("No se encontró InitialNode en la política {}", id);
                return tareas; // No se puede deducir el orden sin inicio
            }

            // 4. Recorrido Topológico (BFS) siguiendo las flechas
            Set<String> visited = new HashSet<>();
            List<Element> queue = new ArrayList<>();
            queue.add(initialNode);

            while (!queue.isEmpty()) {
                Element current = queue.remove(0);
                String currentId = current.getAttribute("id");
                
                // Evitar ciclos infinitos
                if (visited.contains(currentId)) continue;
                visited.add(currentId);

                String tagName = current.getLocalName() != null ? current.getLocalName() : current.getTagName();
                
                // Si es una Tarea/Actividad, la agregamos a nuestra lista final ordenada
                if (tagName.contains("OpaqueAction") || tagName.equals("Action") || tagName.contains("Task")) {
                    String taskName = current.getAttribute("name");
                    String laneName = laneMap.get(currentId);
                    if (laneName == null) laneName = "Atención General";

                    TareaInfo info = new TareaInfo(currentId, taskName, laneName, false, "VACIO");
                    
                    // Buscar si el siguiente paso es una decisión (para pintar el combo especial en el formulario)
                    buscarDecisionSiguiente(doc, currentId, info, laneMap);
                    
                    tareas.add(info);
                }

                // 5. Encontrar los siguientes nodos siguiendo las flechas salientes <outgoing>
                NodeList outFlows = current.getElementsByTagNameNS("*", "outgoing");
                if (outFlows.getLength() == 0) outFlows = current.getElementsByTagName("outgoing");

                for (int i = 0; i < outFlows.getLength(); i++) {
                    String flowId = outFlows.item(i).getTextContent().trim();
                    String targetNodeId = flowTargetMap.get(flowId);
                    
                    if (targetNodeId != null) {
                        Element nextNode = allNodesMap.get(targetNodeId);
                        // Añadir a la cola solo si no lo hemos visitado
                        if (nextNode != null && !visited.contains(targetNodeId)) {
                            queue.add(nextNode);
                        }
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error extrayendo tareas con Ordenamiento Topológico", e);
        }
        return tareas;
    }

    private void buscarDecisionSiguiente(Document doc, String taskId, TareaInfo info, Map<String, String> laneMap) {
        try {
            // 1. Encontrar el nodo de la tarea por ID
            NodeList allNodes = doc.getElementsByTagName("*");
            Element taskNode = null;
            for(int i=0; i<allNodes.getLength(); i++) {
                Element n = (Element) allNodes.item(i);
                if (taskId.equals(n.getAttribute("id"))) {
                    taskNode = n;
                    break;
                }
            }
            if (taskNode == null) return;

            // 2. Obtener TODOS los flujos salientes (outgoing)
            List<String> outgoingFlowIds = new ArrayList<>();
            NodeList outFlows = taskNode.getElementsByTagName("outgoing");
            if (outFlows.getLength() == 0) outFlows = taskNode.getElementsByTagNameNS("*", "outgoing");
            
            for (int i = 0; i < outFlows.getLength(); i++) {
                outgoingFlowIds.add(outFlows.item(i).getTextContent().trim());
            }

            if (outgoingFlowIds.isEmpty()) return;

            // 3. Mapear ControlFlows/SequenceFlows
            NodeList flows = doc.getElementsByTagName("ControlFlow");
            if (flows.getLength() == 0) flows = doc.getElementsByTagNameNS("*", "ControlFlow");
            if (flows.getLength() == 0) flows = doc.getElementsByTagName("sequenceFlow");
            if (flows.getLength() == 0) flows = doc.getElementsByTagNameNS("*", "sequenceFlow");

            for (String flowId : outgoingFlowIds) {
                String targetId = null;
                for(int i=0; i<flows.getLength(); i++) {
                    Element flow = (Element) flows.item(i);
                    if (flowId.equals(flow.getAttribute("id"))) {
                        targetId = flow.getAttribute("targetRef");
                        break;
                    }
                }

                if (targetId != null) {
                    for(int i=0; i<allNodes.getLength(); i++) {
                        Element n = (Element) allNodes.item(i);
                        String localName = n.getLocalName() != null ? n.getLocalName() : n.getTagName();
                        
                        // Si el destino es un DecisionNode o ExclusiveGateway (BPMN)
                        if (targetId.equals(n.getAttribute("id")) && 
                           (localName.contains("DecisionNode") || localName.contains("ExclusiveGateway"))) {
                            
                            info.setEsPuntoDecision(true);
                            List<TareaInfo.DecisionBranch> ramas = new ArrayList<>();
                            
                            // Obtener flujos salientes del Gateway
                            NodeList gwOuts = n.getElementsByTagName("outgoing");
                            if (gwOuts.getLength() == 0) gwOuts = n.getElementsByTagNameNS("*", "outgoing");

                            for (int j = 0; j < gwOuts.getLength(); j++) {
                                String branchFlowId = gwOuts.item(j).getTextContent().trim();
                                for (int k = 0; k < flows.getLength(); k++) {
                                    Element s = (Element) flows.item(k);
                                    if (branchFlowId.equals(s.getAttribute("id"))) {
                                        String condicion = s.getAttribute("name");
                                        String destNodeId = s.getAttribute("targetRef");
                                        
                                        // Buscar nombre y depto del nodo destino
                                        String destName = "Fin";
                                        for(int m=0; m<allNodes.getLength(); m++) {
                                            Element node = (Element) allNodes.item(m);
                                            if (destNodeId.equals(node.getAttribute("id"))) {
                                                destName = node.getAttribute("name");
                                                if (destName == null || destName.trim().isEmpty()) {
                                                    String ln = node.getLocalName() != null ? node.getLocalName() : node.getTagName();
                                                    if (ln.contains("InitialNode")) destName = "Inicio";
                                                    else if (ln.contains("ActivityFinalNode")) destName = "Fin";
                                                    else if (ln.contains("DecisionNode") || ln.contains("ExclusiveGateway")) destName = "Decisión";
                                                    else destName = ln;
                                                }
                                                break;
                                            }
                                        }
                                        
                                        String destLane = laneMap.get(destNodeId);
                                        String fullDestName = destName + (destLane != null ? " (" + destLane + ")" : "");
                                        if (condicion == null || condicion.trim().isEmpty()) condicion = "Opción " + (ramas.size() + 1);
                                        
                                        ramas.add(new TareaInfo.DecisionBranch(branchFlowId, condicion, destNodeId, fullDestName));
                                    }
                                }
                            }
                            info.setRamas(ramas);
                            return; // Encontrado
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error buscando DecisionNode", e);
        }
    }
}
