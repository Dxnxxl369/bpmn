package com.uagrm.gestion.tramites.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.uagrm.gestion.tramites.model.EstadisticaTarea;
import com.uagrm.gestion.tramites.model.InstanciaProceso;
import com.uagrm.gestion.tramites.model.TareaInstancia;
import com.uagrm.gestion.tramites.repository.EstadisticaTareaRepository;
import com.uagrm.gestion.tramites.repository.InstanciaProcesoRepository;
import com.uagrm.gestion.tramites.repository.MacroProcesoPasoRepository;
import com.uagrm.gestion.tramites.repository.TareaInstanciaRepository;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProcesoMotorService {

    private static final Logger log = LoggerFactory.getLogger(ProcesoMotorService.class);
    private final InstanciaProcesoRepository instanciaRepository;
    private final TareaInstanciaRepository tareaRepository;
    private final UsuarioRepository usuarioRepository;
    private final MacroProcesoPasoRepository macroPasoRepository;
    private final EstadisticaTareaRepository estadisticaRepository;
    private final DepartamentoService departamentoService;
    private final PoliticaNegocioService politicaService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final com.uagrm.gestion.tramites.repository.LinkedTaskRepository linkedTaskRepository;
    private final com.uagrm.gestion.tramites.repository.UserDeviceRepository userDeviceRepository;
    private final PushNotificationService pushNotificationService;

    private void notificarInteresados(InstanciaProceso instancia, String titulo, String mensaje) {
        try {
            linkedTaskRepository.findByProcessInstanceId(instancia.getId()).forEach(link -> {
                userDeviceRepository.findByUserId(link.getUserId()).ifPresent(device -> {
                    pushNotificationService.sendPushNotification(device.getFcmToken(), titulo, mensaje);
                });
            });
        } catch (Exception e) {
            log.error("Error al enviar notificaciones push: " + e.getMessage());
        }
    }

    public com.uagrm.gestion.tramites.model.PoliticaNegocio obtenerPolitica(String id) {
        return politicaService.obtenerPorId(id).orElseThrow();
    }

    public InstanciaProceso obtenerInstancia(String id) {
        return instanciaRepository.findById(id).orElseThrow();
    }

    public InstanciaProceso iniciarInstancia(String politicaId, String xmlBpmn, String solicitante) {
        politicaService.activarPolitica(politicaId);
        InstanciaProceso instancia = new InstanciaProceso();
        instancia.setPoliticaNegocioId(politicaId);
        instancia.setXmlBpmn(xmlBpmn);
        instancia.setSolicitanteNombre(solicitante != null ? solicitante : "Solicitante Desconocido");
        instancia.setEstado("EN_CURSO");
        instancia.setResultadoFinal("EN_CURSO"); // AMARILLO inicialmente
        instancia.setFechaInicio(Instant.now());
        instancia.setContextoJson("{}");

        // GENERAR CÓDIGO DE SEGUIMIENTO (TOKEN CLIENTE)
        String token = "UAGRM-" + (100000 + new java.util.Random().nextInt(900000));
        instancia.setCodigoSeguimiento(token);

        instancia = instanciaRepository.save(instancia);

        try {
            String startEventId = findStartEvent(xmlBpmn);
            if (startEventId == null) throw new RuntimeException("No StartEvent found");
            avanzarDesde(instancia, startEventId);
        } catch (Exception e) {
            throw new RuntimeException("Error starting engine: " + e.getMessage());
        }

        return instancia;
    }

    public TareaInstancia atenderTarea(String tareaId, String userEmail) {
        TareaInstancia tarea = tareaRepository.findById(tareaId).orElseThrow();
        if ("PENDIENTE".equals(tarea.getEstado())) {
            tarea.setEstado("EN_PROCESO");
            tarea.setFechaAtencion(Instant.now());
            
            usuarioRepository.findByEmail(userEmail).ifPresent(u -> {
                tarea.setUsuarioId(u.getId());
            });
            
            return tareaRepository.save(tarea);
        }
        return tarea;
    }

    public TareaInstancia completarTarea(String tareaId, String respuestasJson) {
        TareaInstancia tarea = tareaRepository.findById(tareaId).orElseThrow();
        tarea.setEstado("COMPLETADA");
        tarea.setRespuestasJson(respuestasJson);
        tarea.setFechaCompletado(Instant.now());
        tareaRepository.save(tarea);

        InstanciaProceso instancia = instanciaRepository.findById(tarea.getInstanciaProcesoId()).orElseThrow();
        
        try {
            ObjectNode contexto = (ObjectNode) objectMapper.readTree(instancia.getContextoJson());
            JsonNode nuevasRespuestas = objectMapper.readTree(respuestasJson);
            
            if (nuevasRespuestas.isObject()) {
                nuevasRespuestas.fields().forEachRemaining(entry -> {
                    String keyOriginal = entry.getKey();
                    String keyNormalizada = keyOriginal.toLowerCase().replace(" ", "").trim();
                    contexto.set(keyOriginal, entry.getValue());
                    
                    // CAPTURA INTELIGENTE POR PATRONES (Nombre y Apellido)
                    if (keyNormalizada.contains("nombre") || keyNormalizada.contains("apellido") || keyNormalizada.contains("solicitante") || keyNormalizada.contains("cliente")) {
                        String nombreActual = instancia.getSolicitanteNombre() != null ? instancia.getSolicitanteNombre() : "";
                        String valorNuevo = entry.getValue().asText();
                        
                        if (nombreActual.isEmpty() || nombreActual.equals("Solicitante Desconocido")) {
                             instancia.setSolicitanteNombre(valorNuevo);
                        } else if (!nombreActual.contains(valorNuevo)) {
                             // Si ya tenemos el nombre y llega el apellido (o viceversa), concatenamos
                             instancia.setSolicitanteNombre(nombreActual + " " + valorNuevo);
                        }
                    }
                    
                    // Aseguramos que campos críticos también estén en minúsculas para el frontend
                    if (keyNormalizada.contains("ci") || keyNormalizada.contains("cedula") || keyNormalizada.contains("identifi")) {
                        contexto.set("ci_global", entry.getValue());
                    }
                    if (keyNormalizada.contains("correo") || keyNormalizada.contains("email")) {
                        contexto.set("email_global", entry.getValue());
                    }
                    if (keyNormalizada.contains("telef") || keyNormalizada.contains("celular")) {
                        contexto.set("telefono_global", entry.getValue());
                    }
                });
            }
            
            // SI LA TAREA ES DE RECHAZO, MARCAR RESULTADO COMO RECHAZADO (ROJO)
            if (tarea.getNombre().toLowerCase().contains("rechazo") || tarea.getNombre().toLowerCase().contains("denegado")) {
                instancia.setResultadoFinal("RECHAZADO");
            }

            instancia.setContextoJson(objectMapper.writeValueAsString(contexto));
            instanciaRepository.save(instancia);
        } catch (Exception e) {
            e.printStackTrace();
        }

        EstadisticaTarea est = new EstadisticaTarea();
        est.setPoliticaNegocioId(instancia.getPoliticaNegocioId());
        est.setTaskDefinitionId(tarea.getTaskDefinitionId());
        est.setLaneId(tarea.getLaneId());
        est.setNodoNombre(tarea.getNombre());
        
        // REFUERZO DE CAPTURA DE USUARIO (MODO EXPERTO)
        String uId = tarea.getUsuarioId();
        if (uId == null || uId.isEmpty() || "SISTEMA".equals(uId)) {
            try {
                Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                uId = principal.toString(); // En JWT es el email
            } catch (Exception e) {
                uId = "SISTEMA";
            }
        }

        final String finalId = uId;
        usuarioRepository.findById(finalId != null ? finalId : "")
            .or(() -> usuarioRepository.findByEmail(finalId))
            .ifPresentOrElse(u -> {
                est.setUsuarioId(u.getId());
                String completo = (u.getNombre() != null ? u.getNombre() : "") + " " + (u.getApellido() != null ? u.getApellido() : "");
                est.setUsuarioNombre(completo.trim().isEmpty() ? u.getUsername() : completo.trim());
            }, () -> {
                // Si no encontramos al usuario por ID/Email, guardamos lo que tengamos como nombre
                est.setUsuarioNombre(finalId);
                est.setUsuarioId(null);
            });

        Instant inicio = tarea.getFechaInicio();
        Instant fin = tarea.getFechaCompletado() != null ? tarea.getFechaCompletado() : Instant.now();
        // FALLBACK: Si no hay fecha de atención, el tiempo de ejecución es el total desde inicio hasta fin
        Instant atencion = tarea.getFechaAtencion() != null ? tarea.getFechaAtencion() : inicio;

        long espera = Duration.between(inicio, atencion).getSeconds();
        long ejecucion = Duration.between(atencion, fin).getSeconds();
        long total = Duration.between(inicio, fin).getSeconds();

        est.setEsperaSegundos(espera > 0 ? espera : 0);
        est.setEjecucionSegundos(ejecucion > 0 ? ejecucion : total);
        est.setDuracionSegundos(total);
        est.setFechaRegistro(java.time.LocalDateTime.now());
        
        estadisticaRepository.save(est);

        avanzarDesde(instancia, tarea.getTaskDefinitionId());

        return tarea;
    }

    private void avanzarDesde(InstanciaProceso instancia, String nodoActualId) {
        try {
            Document doc = parseXml(instancia.getXmlBpmn());
            List<Element> siguientes = findNextElements(doc, nodoActualId);

            if (siguientes.isEmpty()) {
                // SI NO HAY SIGUIENTE Y EL ESTADO ERA EN_CURSO, FINALIZAR COMO ÉXITO SI NO HUBO RECHAZO
                if (!"FINALIZADO".equals(instancia.getEstado())) {
                    instancia.setEstado("FINALIZADO");
                    if ("EN_CURSO".equals(instancia.getResultadoFinal())) {
                        instancia.setResultadoFinal("APROBADO"); // VERDE
                    }
                    instancia.setFechaFin(Instant.now());
                    instanciaRepository.save(instancia);
                }
                return;
            }

            Element nextElement = seleccionarCaminoCorrecto(siguientes, instancia);
            if (nextElement == null) return;

            String type = nextElement.getTagName();
            String id = nextElement.getAttribute("id");

            if (type.contains("userTask")) {
                crearTarea(instancia, nextElement);
                notificarInteresados(instancia, "Tu trámite ha avanzado", "Nueva tarea: " + nextElement.getAttribute("name"));
            } else if (type.contains("exclusiveGateway")) {
                avanzarDesde(instancia, id);
            } else if (type.contains("endEvent")) {
                instancia.setEstado("FINALIZADO");
                if ("EN_CURSO".equals(instancia.getResultadoFinal())) {
                    instancia.setResultadoFinal("APROBADO");
                }
                instancia.setFechaFin(Instant.now());
                instanciaRepository.save(instancia);
                notificarInteresados(instancia, "¡Trámite Finalizado!", "Tu solicitud ha concluido con éxito.");
            } else {
                avanzarDesde(instancia, id);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private Element seleccionarCaminoCorrecto(List<Element> candidatos, InstanciaProceso instancia) throws Exception {
        if (candidatos.size() == 1) return findNodeById(parseXml(instancia.getXmlBpmn()), candidatos.get(0).getAttribute("targetRef"));

        JsonNode contexto = objectMapper.readTree(instancia.getContextoJson());
        String decisionHumana = "";
        
        if (contexto.has("decision_motor")) {
            JsonNode node = contexto.get("decision_motor");
            // Si es un objeto (ej: {value: 'Si'}), extraemos el valor. Si es texto, directo.
            decisionHumana = node.isObject() ? node.path("value").asText() : node.asText();
        }
        
        decisionHumana = decisionHumana.trim();

        log.info("CEREBRO MOTOR: Evaluando decisión '{}' para instancia {}", decisionHumana, instancia.getId());

        // 1. PRIMERA PASADA: Búsqueda de coincidencia exacta o literal (Máxima prioridad)
        for (Element flow : candidatos) {
            String label = flow.getAttribute("name").toLowerCase().trim();
            if (label.equalsIgnoreCase(decisionHumana)) {
                log.info("RUTA EXACTA: '{}' coincide con la flecha '{}'.", decisionHumana, label);
                return findNodeById(parseXml(instancia.getXmlBpmn()), flow.getAttribute("targetRef"));
            }
        }

        // 2. SEGUNDA PASADA: Lógica semántica ampliada
        for (Element flow : candidatos) {
            String label = flow.getAttribute("name").toLowerCase().trim();
            String targetRef = flow.getAttribute("targetRef");

            if (label.isEmpty()) continue;

            boolean coincide = false;
            
            // Normalizar variaciones de ÉXITO (Si, Sí, SÍ, Aprobado, etc.)
            String dH = decisionHumana.toLowerCase();
            if (dH.contains("si") || dH.contains("sí") || dH.contains("aprobado") || dH.contains("factible") || dH.contains("exito") || dH.contains("aceptar")) {
                if (label.contains("si") || label.contains("sí") || label.contains("aprobado") || label.contains("factible") || label.contains("exito") || label.contains("aceptar")) coincide = true;
            } 
            // Normalizar variaciones de RECHAZO (No, Rechazado, etc.)
            else if (dH.contains("no") || dH.contains("rechazado") || dH.contains("fallo") || dH.contains("cancelar") || dH.contains("denegar")) {
                if (label.contains("no") || label.contains("rechazado") || label.contains("fallo") || label.contains("cancelar") || label.contains("denegar")) coincide = true;
            }

            if (coincide) {
                log.info("RUTA SEMÁNTICA: '{}' coincide con la flecha '{}'. Saltando a {}", decisionHumana, label, targetRef);
                return findNodeById(parseXml(instancia.getXmlBpmn()), targetRef);
            }
        }

        log.warn("ADVERTENCIA: No se encontró una ruta que coincida con '{}'. Usando ruta por defecto.", decisionHumana);
        return findNodeById(parseXml(instancia.getXmlBpmn()), candidatos.get(0).getAttribute("targetRef"));
    }

    private void crearTarea(InstanciaProceso instancia, Element taskElement) {
        TareaInstancia tarea = new TareaInstancia();
        tarea.setInstanciaProcesoId(instancia.getId());
        tarea.setPoliticaNegocioId(instancia.getPoliticaNegocioId());
        tarea.setTaskDefinitionId(taskElement.getAttribute("id"));
        tarea.setNombre(taskElement.getAttribute("name"));
        tarea.setEstado("PENDIENTE");
        tarea.setSolicitanteNombre(instancia.getSolicitanteNombre());
        tarea.setFechaInicio(Instant.now());
        
        String rawLaneName = resolveRawLaneName(instancia.getXmlBpmn(), tarea.getTaskDefinitionId());
        String normalizedDept = departamentoService.resolverDepartamentoReal(rawLaneName);
        
        tarea.setLaneId(normalizedDept);
        instancia.setLaneId(normalizedDept);
        instanciaRepository.save(instancia);
        tareaRepository.save(tarea);

        messagingTemplate.convertAndSend("/topic/tareas/" + normalizedDept, tarea);
    }

    private List<Element> findNextElements(Document doc, String currentId) {
        List<Element> outgoingFlows = new ArrayList<>();
        NodeList sequences = doc.getElementsByTagNameNS("*", "sequenceFlow");
        for (int i = 0; i < sequences.getLength(); i++) {
            Element flow = (Element) sequences.item(i);
            if (flow.getAttribute("sourceRef").equals(currentId)) outgoingFlows.add(flow);
        }
        return outgoingFlows;
    }

    private Element findNodeById(Document doc, String id) {
        NodeList allNodes = doc.getDocumentElement().getElementsByTagName("*");
        for (int i = 0; i < allNodes.getLength(); i++) {
            Element node = (Element) allNodes.item(i);
            if (node.getAttribute("id").equals(id)) return node;
        }
        return null;
    }

    private String findStartEvent(String xml) throws Exception {
        Document doc = parseXml(xml);
        NodeList starts = doc.getElementsByTagNameNS("*", "startEvent");
        return starts.getLength() > 0 ? ((Element) starts.item(0)).getAttribute("id") : null;
    }

    public String obtenerDepartamentoInicial(String xml) {
        try {
            Document doc = parseXml(xml);
            String startEventId = findStartEvent(xml);
            if (startEventId == null) return null;

            List<Element> siguientes = findNextElements(doc, startEventId);
            if (siguientes.isEmpty()) return null;

            // Buscamos el primer nodo de tarea (userTask) o el que siga al gateway
            Element primerNodo = siguientes.get(0);
            String targetId = primerNodo.getAttribute("targetRef");
            
            // Si el primer nodo es un Gateway, seguimos buscando el primer UserTask
            if (targetId.toLowerCase().contains("gateway")) {
                List<Element> despuesGateway = findNextElements(doc, targetId);
                if (!despuesGateway.isEmpty()) {
                    targetId = despuesGateway.get(0).getAttribute("targetRef");
                }
            }

            String rawLaneName = resolveRawLaneName(xml, targetId);
            return departamentoService.resolverDepartamentoReal(rawLaneName);
        } catch (Exception e) {
            log.error("Error al obtener departamento inicial", e);
            return null;
        }
    }

    private String resolveRawLaneName(String xml, String taskId) {
        try {
            Document doc = parseXml(xml);
            NodeList lanes = doc.getElementsByTagNameNS("*", "lane");
            for (int i = 0; i < lanes.getLength(); i++) {
                Element lane = (Element) lanes.item(i);
                NodeList refs = lane.getElementsByTagNameNS("*", "flowNodeRef");
                for (int j = 0; j < refs.getLength(); j++) {
                    if (refs.item(j).getTextContent().equals(taskId)) return lane.getAttribute("name");
                }
            }
        } catch (Exception e) { e.printStackTrace(); }
        return "GENERAL";
    }

    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        org.xml.sax.InputSource is = new org.xml.sax.InputSource(new java.io.StringReader(xml));
        is.setEncoding("UTF-8");
        return builder.parse(is);
    }
}
