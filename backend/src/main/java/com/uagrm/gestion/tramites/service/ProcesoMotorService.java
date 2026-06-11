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
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
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
    private final com.uagrm.gestion.tramites.repository.DocumentoRepository documentoRepository;
    private final PushNotificationService pushNotificationService;
    private final S3Service s3Service;
    private final VisionService visionService;
    private final AuditoriaService auditoriaService;

    public S3Service getS3Service() {
        return this.s3Service;
    }

    public com.uagrm.gestion.tramites.model.PoliticaNegocio obtenerPolitica(String id) {
        return politicaService.obtenerPorId(id).orElseThrow();
    }

    public InstanciaProceso obtenerInstancia(String id) {
        return instanciaRepository.findById(id).orElseThrow();
    }

    public InstanciaProceso iniciarInstancia(String politicaId, String xmlUml, String solicitante) {
        return iniciarInstancia(politicaId, xmlUml, solicitante, null);
    }

    public InstanciaProceso iniciarInstancia(String politicaId, String xmlUml, String solicitante, String clienteCi) {
        politicaService.activarPolitica(politicaId);
        InstanciaProceso instancia = new InstanciaProceso();
        instancia.setPoliticaNegocioId(politicaId);
        instancia.setXmlBpmn(xmlUml); 
        instancia.setSolicitanteNombre(solicitante != null ? solicitante : "Solicitante Desconocido");
        instancia.setClienteCi(clienteCi);
        instancia.setEstado("EN_CURSO");
        instancia.setResultadoFinal("EN_CURSO");
        instancia.setFechaInicio(Instant.now());
        instancia.setContextoJson("{}");

        String token = "UAGRM-" + (100000 + new java.util.Random().nextInt(900000));
        instancia.setCodigoSeguimiento(token);

        instancia = instanciaRepository.save(instancia);
        
        if (clienteCi != null && !clienteCi.isBlank()) {
            List<com.uagrm.gestion.tramites.model.Documento> huerfanos = documentoRepository.findByClienteCi(clienteCi).stream()
                .filter(d -> d.getInstanciaId() == null || d.getInstanciaId().isBlank())
                .collect(java.util.stream.Collectors.toList());
            
            for (com.uagrm.gestion.tramites.model.Documento doc : huerfanos) {
                doc.setInstanciaId(instancia.getId());
                documentoRepository.save(doc);
            }
        }
        
        auditoriaService.registrar("SISTEMA", solicitante, "INICIO TRÁMITE UML", "MOTOR PROCESOS", instancia.getId(), "Inició el trámite con código " + token + (clienteCi != null ? " para CI: " + clienteCi : ""));

        notificarCliente(instancia.getId(), clienteCi, "Trámite Iniciado", "Su solicitud ha sido recibida. Código: " + token, "#007BFF");

        try {
            String initialNodeId = findInitialNode(xmlUml);
            if (initialNodeId == null) throw new RuntimeException("No InitialNode found");
            avanzarDesde(instancia, initialNodeId);
        } catch (Exception e) {
            throw new RuntimeException("Error starting UML engine: " + e.getMessage());
        }

        return instancia;
    }

    public List<com.uagrm.gestion.tramites.model.Documento> obtenerDocumentosCliente(String clienteCi) {
        return documentoRepository.findByClienteCi(clienteCi);
    }

    public void guardarDocumentoModificado(com.uagrm.gestion.tramites.model.Documento doc) {
        documentoRepository.save(doc);
    }

    public InstanciaProceso guardarInstancia(InstanciaProceso instancia) {
        return instanciaRepository.save(instancia);
    }

    public void actualizarVariablesInstancia(String instanciaId, String respuestasJson) {
        InstanciaProceso instancia = instanciaRepository.findById(instanciaId).orElseThrow();
        try {
            ObjectNode contexto = (ObjectNode) objectMapper.readTree(instancia.getContextoJson());
            JsonNode nuevasRespuestas = objectMapper.readTree(respuestasJson);
            if (nuevasRespuestas.isObject()) {
                nuevasRespuestas.fields().forEachRemaining(entry -> contexto.set(entry.getKey(), entry.getValue()));
            }
            instancia.setContextoJson(objectMapper.writeValueAsString(contexto));
            instancia.setEstado("EN_CURSO");
            instanciaRepository.save(instancia);
            
            auditoriaService.registrar("CIUDADANO", "SISTEMA", "SUBSANACIÓN ENVIADA", "MOTOR PROCESOS", instancia.getId(), "El ciudadano envió correcciones de documentos.");
        } catch (Exception e) { e.printStackTrace(); }
    }

    public TareaInstancia atenderTarea(String tareaId, String userEmail) {
        TareaInstancia tarea = tareaRepository.findById(tareaId).orElseThrow();
        if ("PENDIENTE".equals(tarea.getEstado())) {
            tarea.setEstado("EN_PROCESO");
            tarea.setFechaAtencion(Instant.now());
            
            usuarioRepository.findByEmail(userEmail).ifPresent(u -> {
                tarea.setUsuarioId(u.getId());
                auditoriaService.registrar(u.getId(), u.getNombre() + " " + u.getApellido(), "ATENDER TAREA", "MOTOR PROCESOS", tarea.getInstanciaProcesoId(), "Atención de tarea UML: " + tarea.getNombre());

                instanciaRepository.findById(tarea.getInstanciaProcesoId()).ifPresent(inst -> {
                    notificarCliente(inst.getId(), inst.getClienteCi(), "Trámite en Atención", 
                        "Un funcionario ha comenzado a procesar su solicitud en: " + tarea.getNombre(), "#007BFF");
                });
            });

            return tareaRepository.save(tarea);
        }
        return tarea;
    }

    public TareaInstancia completarTarea(String tareaId, String respuestasJson) {
        log.info("âš¡ [MOTOR-DEBUG] Iniciando COMPLETAR TAREA: {}", tareaId);
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
                nuevasRespuestas.fields().forEachRemaining(entry -> contexto.set(entry.getKey(), entry.getValue()));
            }
            instancia.setContextoJson(objectMapper.writeValueAsString(contexto));
            instanciaRepository.save(instancia);
        } catch (Exception e) { e.printStackTrace(); }

        auditoriaService.registrar(tarea.getUsuarioId(), "FUNCIONARIO", "COMPLETAR TAREA UML", "MOTOR PROCESOS", instancia.getId(), "Completó: " + tarea.getNombre());

        try {
            EstadisticaTarea stats = new EstadisticaTarea();
            stats.setPoliticaNegocioId(tarea.getPoliticaNegocioId());
            stats.setTaskDefinitionId(tarea.getTaskDefinitionId());
            stats.setNodoNombre(tarea.getNombre());
            stats.setUsuarioId(tarea.getUsuarioId());
            stats.setLaneId(tarea.getLaneId());
            stats.setFechaRegistro(LocalDateTime.now());

            usuarioRepository.findById(tarea.getUsuarioId()).ifPresent(u -> 
                stats.setUsuarioNombre(u.getNombre() + " " + u.getApellido())
            );

            if (tarea.getFechaInicio() != null && tarea.getFechaAtencion() != null) {
                stats.setEsperaSegundos(Duration.between(tarea.getFechaInicio(), tarea.getFechaAtencion()).getSeconds());
            }
            if (tarea.getFechaAtencion() != null && tarea.getFechaCompletado() != null) {
                stats.setEjecucionSegundos(Duration.between(tarea.getFechaAtencion(), tarea.getFechaCompletado()).getSeconds());
            }
            if (tarea.getFechaInicio() != null && tarea.getFechaCompletado() != null) {
                stats.setDuracionSegundos(Duration.between(tarea.getFechaInicio(), tarea.getFechaCompletado()).getSeconds());
            }

            estadisticaRepository.save(stats);
            log.info("✅ Estadística registrada para: {}", stats.getUsuarioNombre());
        } catch (Exception e) {
            log.error("Error al registrar estadísticas: {}", e.getMessage());
        }

        avanzarDesde(instancia, tarea.getTaskDefinitionId());

        return tarea;
    }

    private void avanzarDesde(InstanciaProceso instancia, String nodoActualId) {
        log.info("ðŸ”🔍 [MOTOR-DEBUG] Avanzando proceso desde el nodo: {}", nodoActualId);
        try {
            Document doc = parseXml(instancia.getXmlBpmn());
            List<Element> siguientes = findNextElements(doc, nodoActualId);
            log.info("ðŸ”🔍 [MOTOR-DEBUG] Nodos candidatos encontrados: {}", siguientes.size());

            if (siguientes.isEmpty()) {
                if (!"FINALIZADO".equals(instancia.getEstado())) {
                    log.info("ðŸŽ¯ [MOTOR-DEBUG] Â¡FIN DE CAMINO ALCANZADO! Finalizando...");
                    instancia.setEstado("FINALIZADO");
                    instancia.setFechaFin(Instant.now());
                    instanciaRepository.save(instancia);

                    consolidarDocumentosFinales(instancia);
                    notificarClienteFinalizacion(instancia);
                }
                return;
            }

            Element nextElement = seleccionarCaminoCorrecto(siguientes, instancia);
            if (nextElement == null) return;

            String type = nextElement.getTagName().toLowerCase();
            String id = nextElement.getAttribute("id");
            log.info("ðŸš€ [MOTOR-DEBUG] Siguiente nodo detectado: {} (Tipo: {})", id, type);

            if (type.contains("opaqueaction") || type.contains("action")) {
                crearTarea(instancia, nextElement);
            } else if (type.contains("decisionnode")) {
                avanzarDesde(instancia, id);
            } else if (type.contains("finalnode")) {
                log.info("ðŸŽ¯ [MOTOR-DEBUG] Â¡NODO FINAL UML ALCANZADO! (ID: {}). Finalizando trámite...", id);
                instancia.setEstado("FINALIZADO");
                instancia.setFechaFin(Instant.now());
                instanciaRepository.save(instancia);

                consolidarDocumentosFinales(instancia);
                notificarClienteFinalizacion(instancia);
            } else {
                log.info("âž¡ï¸ [MOTOR-DEBUG] Nodo de salto (Jump): {}. Avanzando...", type);
                avanzarDesde(instancia, id);
            }

        } catch (Exception e) { e.printStackTrace(); }
    }


    private Element seleccionarCaminoCorrecto(List<Element> candidatos, InstanciaProceso instancia) throws Exception {
        if (candidatos.size() == 1) return findNodeById(parseXml(instancia.getXmlBpmn()), candidatos.get(0).getAttribute("targetRef"));

        JsonNode contexto = objectMapper.readTree(instancia.getContextoJson());
        String decision = contexto.path("decision_motor").asText().trim();

        for (Element flow : candidatos) {
            String name = flow.getAttribute("name");
            if (name != null && name.equalsIgnoreCase(decision)) {
                return findNodeById(parseXml(instancia.getXmlBpmn()), flow.getAttribute("targetRef"));
            }
        }
        return findNodeById(parseXml(instancia.getXmlBpmn()), candidatos.get(0).getAttribute("targetRef"));
    }

    private void crearTarea(InstanciaProceso instancia, Element taskElement) {
        TareaInstancia tarea = new TareaInstancia();
        tarea.setInstanciaProcesoId(instancia.getId());
        tarea.setPoliticaNegocioId(instancia.getPoliticaNegocioId());
        tarea.setTaskDefinitionId(taskElement.getAttribute("id"));
        tarea.setNombre(taskElement.getAttribute("name"));
        tarea.setEstado("PENDIENTE");
        tarea.setFechaInicio(Instant.now());

        String rawLaneName = resolveRawLaneName(instancia.getXmlBpmn(), tarea.getTaskDefinitionId());
        String normalizedDept = departamentoService.resolverDepartamentoReal(rawLaneName);

        tarea.setLaneId(normalizedDept);
        tareaRepository.save(tarea);

        messagingTemplate.convertAndSend("/topic/tareas/" + normalizedDept, tarea);

        notificarCliente(instancia.getId(), instancia.getClienteCi(), "Actualización de Trámite", 
            "Su trámite ha pasado a la etapa: " + tarea.getNombre(), "#FFD700");
    }

    public void notificarCliente(String instanciaId, String clienteCi, String titulo, String mensaje, String colorHex) {
        log.info("ðŸ”🔍 [MOTOR-DEBUG] Iniciando ruteo de notificaciÃ³n para Instancia: {}", instanciaId);
        
        java.util.Set<String> tokensEnviados = new java.util.HashSet<>();

        if (clienteCi != null && !clienteCi.isBlank()) {
            userDeviceRepository.findByUserId(clienteCi).ifPresent(device -> {
                if (device.getFcmToken() != null && tokensEnviados.add(device.getFcmToken())) {
                    log.info("ðŸ”🔍 [MOTOR-DEBUG] Notificando a CI directo: {}", clienteCi);
                    pushNotificationService.sendPushNotification(device.getFcmToken(), titulo, mensaje, colorHex);
                }
            });

            usuarioRepository.findByCi(clienteCi).ifPresent(u -> {
                userDeviceRepository.findByUserId(u.getId()).ifPresent(device -> {
                    if (device.getFcmToken() != null && tokensEnviados.add(device.getFcmToken())) {
                        log.info("ðŸ”🔍 [MOTOR-DEBUG] Notificando a Usuario {} vinculado por CI {}", u.getNombre(), clienteCi);
                        pushNotificationService.sendPushNotification(device.getFcmToken(), titulo, mensaje, colorHex);
                    }
                });
            });
        }

        if (instanciaId != null) {
            List<com.uagrm.gestion.tramites.model.LinkedTask> vinculaciones = linkedTaskRepository.findByProcessInstanceId(instanciaId);
            for (com.uagrm.gestion.tramites.model.LinkedTask link : vinculaciones) {
                if (link.getUserId() != null && !link.getUserId().equals("GUEST")) {
                    userDeviceRepository.findByUserId(link.getUserId()).ifPresent(device -> {
                        if (device.getFcmToken() != null && tokensEnviados.add(device.getFcmToken())) {
                            log.info("ðŸ”🔍 [MOTOR-DEBUG] Notificando a Vinculado (UserID): {}", link.getUserId());
                            pushNotificationService.sendPushNotification(device.getFcmToken(), titulo, mensaje, colorHex);
                        }
                    });
                }
                if (link.getDeviceToken() != null && tokensEnviados.add(link.getDeviceToken())) {
                    log.info("ðŸ”🔍 [MOTOR-DEBUG] Notificando a Vinculado (Token Directo/Invitado)");
                    pushNotificationService.sendPushNotification(link.getDeviceToken(), titulo, mensaje, colorHex);
                }
            }
        }
    }

    private void consolidarDocumentosFinales(InstanciaProceso instancia) {
        log.info(">> [IA-CONSOLIDACIÓN] Iniciando conversión de documentos oficiales a PDF...");
        List<com.uagrm.gestion.tramites.model.Documento> oficiales = documentoRepository.findByInstanciaIdAndEsColaborativoTrueAndEsActualTrue(instancia.getId());

        for (com.uagrm.gestion.tramites.model.Documento htmlDoc : oficiales) {
            try {
                if (htmlDoc.getContenidoHtml() == null || htmlDoc.getContenidoHtml().isBlank()) continue;

                byte[] pdfBytes = visionService.convertHtmlToPdf(htmlDoc.getContenidoHtml());
                if (pdfBytes != null) {
                    String nombrePdf = htmlDoc.getNombreArchivo().replace(".html", "") + "_OFICIAL.pdf";
                    String key = "documentos/" + java.util.UUID.randomUUID() + "_" + nombrePdf;

                    String urlS3 = s3Service.subirArchivoConKey(key, new java.io.ByteArrayInputStream(pdfBytes), pdfBytes.length, "application/pdf");
                    com.uagrm.gestion.tramites.model.Documento entregable = new com.uagrm.gestion.tramites.model.Documento();
                    entregable.setInstanciaId(instancia.getId());
                    entregable.setClienteCi(instancia.getClienteCi());
                    entregable.setNombreArchivo(nombrePdf);
                    entregable.setUrlS3(urlS3);
                    entregable.setEsActual(true);
                    entregable.setEsColaborativo(true);
                    entregable.setTipoDocumento("ENTREGABLE_FINAL");
                    entregable.setVersion(htmlDoc.getVersion());
                    entregable.setFuncionarioNombre(htmlDoc.getFuncionarioNombre());
                    entregable.setDepartamentoNombre(htmlDoc.getDepartamentoNombre());
                    entregable.setFechaSubida(Instant.now());

                    documentoRepository.save(entregable);
                    log.info("✅ [IA-CONSOLIDACIÓN] Documento consolidado: {}", urlS3);
                }
            } catch (Exception e) {
                log.error("❌ [IA-CONSOLIDACIÓN] Error al consolidar {}: {}", htmlDoc.getNombreArchivo(), e.getMessage());
            }
        }
    }

    private void notificarClienteFinalizacion(InstanciaProceso instancia) {
        List<com.uagrm.gestion.tramites.model.Documento> oficiales = documentoRepository.findByInstanciaIdAndEsColaborativoTrueAndEsActualTrue(instancia.getId());
        String msgFinal = "¡Felicidades! Su trámite ha concluido con éxito.";
        if (!oficiales.isEmpty()) {
            msgFinal += " Tiene " + oficiales.size() + " documento(s) oficial(es) listos para descargar.";
        }
        notificarCliente(instancia.getId(), instancia.getClienteCi(), "Trámite Finalizado", msgFinal, "#28A745");
    }

    private List<Element> findNextElements(Document doc, String currentId) {
        List<Element> outgoingFlows = new ArrayList<>();
        NodeList sequences = doc.getElementsByTagNameNS("*", "ControlFlow");
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

    private String findInitialNode(String xml) throws Exception {
        Document doc = parseXml(xml);
        NodeList starts = doc.getElementsByTagNameNS("*", "InitialNode");
        return starts.getLength() > 0 ? ((Element) starts.item(0)).getAttribute("id") : null;
    }

    public String obtenerDepartamentoInicial(String xml) {
        try {
            String initialNodeId = findInitialNode(xml);
            if (initialNodeId == null) return null;

            Document doc = parseXml(xml);
            List<Element> siguientes = findNextElements(doc, initialNodeId);
            if (siguientes.isEmpty()) return null;

            Element primerNodo = siguientes.get(0);
            String targetId = primerNodo.getAttribute("targetRef");
            
            if (targetId.toLowerCase().contains("decision") || targetId.toLowerCase().contains("node")) {
                List<Element> despuesGateway = findNextElements(doc, targetId);
                if (!despuesGateway.isEmpty()) {
                    targetId = despuesGateway.get(0).getAttribute("targetRef");
                }
            }

            String rawLaneName = resolveRawLaneName(xml, targetId);
            return departamentoService.resolverDepartamentoReal(rawLaneName);
        } catch (Exception e) {
            log.error("Error al obtener departamento inicial UML", e);
            return null;
        }
    }

    private String resolveRawLaneName(String xml, String taskId) {
        try {
            Document doc = parseXml(xml);
            NodeList partitions = doc.getElementsByTagNameNS("*", "ActivityPartition");
            for (int i = 0; i < partitions.getLength(); i++) {
                Element partition = (Element) partitions.item(i);
                NodeList refs = partition.getElementsByTagNameNS("*", "nodeRef");
                for (int j = 0; j < refs.getLength(); j++) {
                    if (refs.item(j).getTextContent().trim().equals(taskId)) return partition.getAttribute("name");
                }
            }
        } catch (Exception e) { e.printStackTrace(); }
        return "GENERAL";
    }

    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new org.xml.sax.InputSource(new java.io.StringReader(xml)));
    }
}
