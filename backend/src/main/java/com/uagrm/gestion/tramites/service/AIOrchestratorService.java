package com.uagrm.gestion.tramites.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIOrchestratorService {

    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${groq.api.key}")
    private String apiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";//"llama-3.1-8b-instant";//"llama-3.3-70b-versatile";

    // Constantes de Layout (Efecto Escalera + Anti-Colisión)
    private static final int POOL_X          = 160;
    private static final int POOL_Y          = 80;
    private static final int POOL_LABEL_W    = 30;   
    private static final int LANE_HEIGHT     = 180;
    private static final int FIRST_NODE_X    = 270;  
    private static final int NODE_X_STEP     = 200;  
    private static final int TASK_W          = 120;
    private static final int TASK_H          = 80;
    private static final int GW_SIZE         = 50;
    private static final int EVT_SIZE        = 36;

    // =========================================================================
    // analyzeAndExtractProcesses (Lógica DEF Original)
    // =========================================================================
    public List<String> analyzeAndExtractProcesses(String fullText) {
        String systemPrompt = """
            Eres un Arquitecto de Procesos Senior. Identifica los TRÁMITES PRINCIPALES del texto.
            REGLAS:
            1. Si el texto describe un ÚNICO flujo continuo, devuelve UN SOLO nombre.
            2. Si el texto describe MÚLTIPLES trámites independientes, devuelve los nombres SEPARADOS POR COMAS.
            3. Salida EXCLUSIVA: solo el texto con los nombres. Sin markdown, viñetas ni introducciones.
            """;
        String userPrompt = "Extrae los nombres de los trámites principales:\n\n" + fullText;
        try {
            String content = callGroq(userPrompt, systemPrompt);
            return Arrays.stream(content.split(","))
                         .map(String::trim)
                         .filter(s -> !s.isEmpty())
                         .toList();
        } catch (Exception e) {
            log.error("Error al extraer procesos", e);
            return List.of("Proceso de Gestión");
        }
    }

    // =========================================================================
    // generateBPMNXml (Lógica DEF Original)
    // =========================================================================
    public String generateBPMNXml(String processName, String fullContextText) {
        String systemPrompt = """
            Eres un Arquitecto BPMN 2.0 experto. Genera EXCLUSIVAMENTE la semántica XML pura.

            ESTRUCTURA OBLIGATORIA (respeta este orden de elementos exactamente):
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                              xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                              xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                              xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                              id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:collaboration id="Collaboration_1">
                <bpmn:participant id="Participant_1" name="NOMBRE" processRef="Process_1"/>
              </bpmn:collaboration>
              <bpmn:process id="Process_1" isExecutable="true">
                <bpmn:laneSet id="LaneSet_1">
                  <bpmn:lane id="Lane_X" name="Departamento X">
                    <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
                    <bpmn:flowNodeRef>Task_A</bpmn:flowNodeRef>
                  </bpmn:lane>
                </bpmn:laneSet>
                <bpmn:startEvent id="StartEvent_1" name="Inicio">
                  <bpmn:outgoing>Flow_1</bpmn:outgoing>
                </bpmn:startEvent>
                <bpmn:userTask id="Task_A" name="Nombre Tarea">
                  <bpmn:incoming>Flow_1</bpmn:incoming>
                  <bpmn:outgoing>Flow_2</bpmn:outgoing>
                </bpmn:userTask>
                <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_A"/>
              </bpmn:process>
            </bpmn:definitions>

            REGLAS CRÍTICAS:
            1. El <bpmn:process> es HERMANO de <bpmn:collaboration>, NUNCA hijo de <bpmn:participant>.
            2. ABSOLUTAMENTE TODOS los nodos (startEvent, tareas, gateways, endEvents) DEBEN estar en un lane via <bpmn:flowNodeRef>.
            3. Los IDs en flowNodeRef deben ser IDÉNTICOS a los id= de los nodos.
            4. userTask=humanos, serviceTask=sistemas, exclusiveGateway=decisiones.
            5. Nodos con incoming/outgoing referenciando sequenceFlows válidos.
            6. Cada <bpmn:sequenceFlow> saliente de un exclusiveGateway DEBE tener el atributo name="Sí" o name="No" según la decisión.
            7. NO incluyas bpmndi, dc:Bounds ni coordenadas. Solo semántica pura.
            8. NO incluyas triple backtick ni markdown. Solo XML.
            """;

        String userPrompt = String.format(
            "Genera el XML BPMN 2.0 semántico para: '%s'. Un lane por departamento. Flujo: %s",
            processName, fullContextText
        );

        try {
            String raw      = cleanXmlResponse(callGroq(userPrompt, systemPrompt));
            String repaired = repairSemanticXml(raw);
            return injectDiagramBlock(repaired);
        } catch (Exception e) {
            log.error("Error en generateBPMNXml", e);
            return "";
        }
    }

    // =========================================================================
    // repairSemanticXml (Lógica DEF Original)
    // =========================================================================
    public String repairSemanticXml(String xml) {
        try {
            Document doc = parseXml(xml);
            Element root = doc.getDocumentElement();

            NodeList processes = doc.getElementsByTagNameNS("*", "process");
            for (int i = 0; i < processes.getLength(); i++) {
                Element proc = (Element) processes.item(i);
                Node parent = proc.getParentNode();
                if (parent != null && !parent.isSameNode(root)) {
                    log.warn("Reparando: process movido a definitions.");
                    parent.removeChild(proc);
                    root.appendChild(proc);
                }
            }

            Set<String> realNodeIds = new HashSet<>();
            for (String tag : new String[]{"startEvent","endEvent","userTask","serviceTask","task",
                    "exclusiveGateway","parallelGateway","inclusiveGateway",
                    "intermediateCatchEvent","intermediateThrowEvent"}) {
                NodeList nl = doc.getElementsByTagNameNS("*", tag);
                for (int i = 0; i < nl.getLength(); i++) {
                    String id = ((Element) nl.item(i)).getAttribute("id");
                    if (!id.isBlank()) realNodeIds.add(id);
                }
            }

            List<Node> toRemove = new ArrayList<>();
            NodeList refs = doc.getElementsByTagNameNS("*", "flowNodeRef");
            Set<String> referencedByLane = new HashSet<>();
            for (int i = 0; i < refs.getLength(); i++) {
                String refId = refs.item(i).getTextContent().trim();
                if (!realNodeIds.contains(refId)) {
                    toRemove.add(refs.item(i));
                } else {
                    referencedByLane.add(refId);
                }
            }
            toRemove.forEach(n -> n.getParentNode().removeChild(n));

            Set<String> orphanNodes = new HashSet<>(realNodeIds);
            orphanNodes.removeAll(referencedByLane);
            if (!orphanNodes.isEmpty()) {
                NodeList lanes = doc.getElementsByTagNameNS("*", "lane");
                if (lanes.getLength() > 0) {
                    Element lastLane = (Element) lanes.item(lanes.getLength() - 1);
                    for (String orphanId : orphanNodes) {
                        Element fnRef = doc.createElementNS("http://www.omg.org/spec/BPMN/20100524/MODEL", "bpmn:flowNodeRef");
                        fnRef.setTextContent(orphanId);
                        lastLane.appendChild(fnRef);
                    }
                }
            }

            Set<String> removedFlowIds = new HashSet<>();
            NodeList flows = doc.getElementsByTagNameNS("*", "sequenceFlow");
            List<Node> badFlows = new ArrayList<>();
            for (int i = 0; i < flows.getLength(); i++) {
                Element f = (Element) flows.item(i);
                if (!realNodeIds.contains(f.getAttribute("sourceRef")) ||
                    !realNodeIds.contains(f.getAttribute("targetRef"))) {
                    removedFlowIds.add(f.getAttribute("id"));
                    badFlows.add(f);
                }
            }
            badFlows.forEach(n -> n.getParentNode().removeChild(n));

            for (String tag : new String[]{"incoming","outgoing"}) {
                NodeList ioRefs = doc.getElementsByTagNameNS("*", tag);
                List<Node> badIo = new ArrayList<>();
                for (int i = 0; i < ioRefs.getLength(); i++) {
                    if (removedFlowIds.contains(ioRefs.item(i).getTextContent().trim()))
                        badIo.add(ioRefs.item(i));
                }
                badIo.forEach(n -> n.getParentNode().removeChild(n));
            }

            return serializeDoc(doc);
        } catch (Exception e) {
            log.error("repairSemanticXml falló: {}", e.getMessage());
            return xml;
        }
    }

    // =========================================================================
    // injectDiagramBlock (Lógica DEF + Anti-Colisión por Celda)
    // =========================================================================
    public String injectDiagramBlock(String semanticXml) {
        try {
            Document doc = parseXml(semanticXml);
            Element root = doc.getDocumentElement();

            NodeList processes = doc.getElementsByTagNameNS("*", "process");
            if (processes.getLength() == 0) return semanticXml;
            Element processElement = (Element) processes.item(0);
            String processId = processElement.getAttribute("id").isEmpty() ? "Process_1" : processElement.getAttribute("id");
            processElement.setAttribute("id", processId);

            NodeList collabs = doc.getElementsByTagNameNS("*", "collaboration");
            Element collabElement = collabs.getLength() == 0 ? doc.createElementNS("*", "bpmn:collaboration") : (Element) collabs.item(0);
            if (collabs.getLength() == 0) {
                collabElement.setAttribute("id", "Collaboration_1");
                root.insertBefore(collabElement, processElement);
            }
            String collabId = collabElement.getAttribute("id");

            NodeList parts = collabElement.getElementsByTagNameNS("*", "participant");
            if (parts.getLength() == 0) {
                Element participant = doc.createElementNS("*", "bpmn:participant");
                participant.setAttribute("id", "Participant_1");
                participant.setAttribute("name", processElement.getAttribute("name").isEmpty() ? "Proceso" : processElement.getAttribute("name"));
                participant.setAttribute("processRef", processId);
                collabElement.appendChild(participant);
            }

            Map<String, List<String>> adj = new HashMap<>();
            Map<String, String> nodeToLane = new HashMap<>();
            Map<String, String> nodeType = new HashMap<>();
            List<String> laneOrder = new ArrayList<>();

            NodeList lanes = doc.getElementsByTagNameNS("*", "lane");
            for (int i = 0; i < lanes.getLength(); i++) {
                Element lane = (Element) lanes.item(i);
                String lId = lane.getAttribute("id");
                laneOrder.add(lId);
                NodeList fnRefs = lane.getElementsByTagNameNS("*", "flowNodeRef");
                for (int j = 0; j < fnRefs.getLength(); j++) nodeToLane.put(fnRefs.item(j).getTextContent().trim(), lId);
            }

            String[] tags = {"startEvent","endEvent","userTask","serviceTask","exclusiveGateway","parallelGateway","task"};
            for (String tag : tags) {
                NodeList nl = doc.getElementsByTagNameNS("*", tag);
                for (int i = 0; i < nl.getLength(); i++) {
                    String id = ((Element) nl.item(i)).getAttribute("id");
                    if (!id.isEmpty()) nodeType.put(id, tag);
                }
            }

            List<FlowInfo> seqFlows = new ArrayList<>();
            NodeList flows = doc.getElementsByTagNameNS("*", "sequenceFlow");
            for (int i = 0; i < flows.getLength(); i++) {
                Element f = (Element) flows.item(i);
                String src = f.getAttribute("sourceRef"), tgt = f.getAttribute("targetRef");
                adj.computeIfAbsent(src, k -> new ArrayList<>()).add(tgt);
                seqFlows.add(new FlowInfo(f.getAttribute("id"), src, tgt, f.getAttribute("name")));
            }

            Map<String, Integer> depths = new HashMap<>();
            Queue<String> queue = new LinkedList<>();
            NodeList starts = doc.getElementsByTagNameNS("*", "startEvent");
            for (int i = 0; i < starts.getLength(); i++) {
                String id = ((Element) starts.item(i)).getAttribute("id");
                depths.put(id, 0); queue.add(id);
            }

            int maxD = 0;
            while (!queue.isEmpty()) {
                String curr = queue.poll();
                int d = depths.get(curr);
                maxD = Math.max(maxD, d);
                for (String neighbor : adj.getOrDefault(curr, Collections.emptyList())) {
                    if (!depths.containsKey(neighbor)) { depths.put(neighbor, d + 1); queue.add(neighbor); }
                }
            }
            for (String id : nodeType.keySet()) if (!depths.containsKey(id)) depths.put(id, ++maxD);

            // ANTI-COLISIÓN (Logica Backend Mejorada)
            Map<String, int[]> coords = new HashMap<>();
            Set<String> occupied = new HashSet<>();

            depths.entrySet().stream().sorted(Map.Entry.comparingByValue()).forEach(entry -> {
                String id = entry.getKey();
                int col = entry.getValue();
                String laneId = nodeToLane.getOrDefault(id, laneOrder.isEmpty() ? "Lane_1" : laneOrder.get(0));
                
                while (occupied.contains(laneId + "_" + col)) { col++; }
                occupied.add(laneId + "_" + col);

                int laneIdx = Math.max(0, laneOrder.indexOf(laneId));
                String type = nodeType.get(id);
                int w = type.endsWith("Gateway") ? GW_SIZE : (type.contains("Event") ? EVT_SIZE : TASK_W);
                int h = type.endsWith("Gateway") ? GW_SIZE : (type.contains("Event") ? EVT_SIZE : TASK_H);
                
                int x = FIRST_NODE_X + (col * NODE_X_STEP);
                int y = POOL_Y + (laneIdx * LANE_HEIGHT) + (LANE_HEIGHT / 2) - (h / 2);
                coords.put(id, new int[]{x, y, w, h});
            });

            StringBuilder di = new StringBuilder("\n  <bpmndi:BPMNDiagram id=\"BPMNDiagram_1\">\n");
            di.append(String.format("    <bpmndi:BPMNPlane id=\"BPMNPlane_1\" bpmnElement=\"%s\">\n", collabId));
            
            int pW = FIRST_NODE_X + (occupied.size() + 2) * NODE_X_STEP;
            int pH = Math.max(1, laneOrder.size()) * LANE_HEIGHT;
            di.append(String.format("      <bpmndi:BPMNShape id=\"Participant_1_di\" bpmnElement=\"Participant_1\" isHorizontal=\"true\" isExpanded=\"true\"><dc:Bounds x=\"%d\" y=\"%d\" width=\"%d\" height=\"%d\" /></bpmndi:BPMNShape>\n", POOL_X, POOL_Y, pW, pH));
            
            for (int i = 0; i < laneOrder.size(); i++) {
                di.append(String.format("      <bpmndi:BPMNShape id=\"%s_di\" bpmnElement=\"%s\" isHorizontal=\"true\"><dc:Bounds x=\"%d\" y=\"%d\" width=\"%d\" height=\"%d\" /></bpmndi:BPMNShape>\n", laneOrder.get(i), laneOrder.get(i), POOL_X + POOL_LABEL_W, POOL_Y + (i * LANE_HEIGHT), pW - POOL_LABEL_W, LANE_HEIGHT));
            }

            coords.forEach((id, c) -> di.append(String.format("      <bpmndi:BPMNShape id=\"%s_di\" bpmnElement=\"%s\"><dc:Bounds x=\"%d\" y=\"%d\" width=\"%d\" height=\"%d\" /></bpmndi:BPMNShape>\n", id, id, c[0], c[1], c[2], c[3])));
            
            for (FlowInfo flow : seqFlows) {
                int[] s = coords.get(flow.sourceRef), t = coords.get(flow.targetRef);
                if (s != null && t != null) {
                    di.append(String.format("      <bpmndi:BPMNEdge id=\"%s_di\" bpmnElement=\"%s\"><di:waypoint x=\"%d\" y=\"%d\" /><di:waypoint x=\"%d\" y=\"%d\" />", flow.id, flow.id, s[0] + s[2], s[1] + (s[3]/2), t[0], t[1] + (t[3]/2)));
                    if (flow.name != null && !flow.name.isEmpty()) {
                        di.append(String.format("<bpmndi:BPMNLabel><dc:Bounds x=\"%d\" y=\"%d\" width=\"30\" height=\"14\" /></bpmndi:BPMNLabel>", (s[0]+s[2]+t[0])/2, (s[1]+t[1])/2 - 15));
                    }
                    di.append("</bpmndi:BPMNEdge>\n");
                }
            }
            di.append("    </bpmndi:BPMNPlane>\n  </bpmndi:BPMNDiagram>\n");

            String finalXml = serializeDoc(doc).replace("</bpmn:definitions>", di.toString() + "</bpmn:definitions>");
            if (!finalXml.contains("xmlns:bpmndi")) {
                finalXml = finalXml.replace("<bpmn:definitions", "<bpmn:definitions xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" ");
            }
            return finalXml;
        } catch (Exception e) {
            log.error("Fallo Layout", e);
            return semanticXml;
        }
    }

    public String analyzeBottlenecks(String xmlBpmn) {
        String systemPrompt = "Eres un Consultor Lean Six Sigma experto. Analiza el XML y genera 4 secciones: ## Cuellos de Botella, ## Tiempos, ## Puntos de Atasco, ## Recomendaciones.";
        try { return callGroq("Analiza:\n" + xmlBpmn, systemPrompt); } catch (Exception e) { return "Error"; }
    }

    public String editBPMNXml(String xmlActual, String instruccion) {
        String systemPrompt = "Eres un editor experto en BPMN 2.0. Aplica el cambio solicitado sin alterar IDs existentes. Devuelve el XML completo sin markdown.";
        try { return injectDiagramBlock(repairSemanticXml(cleanXmlResponse(callGroq("XML:\n" + xmlActual + "\nInstrucción: " + instruccion, systemPrompt)))); } catch (Exception e) { return xmlActual; }
    }

    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
        f.setNamespaceAware(true);
        return f.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }

    private String serializeDoc(Document doc) throws Exception {
        Transformer t = TransformerFactory.newInstance().newTransformer();
        t.setOutputProperty(OutputKeys.INDENT, "yes");
        t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        StringWriter w = new StringWriter();
        t.transform(new DOMSource(doc), new StreamResult(w));
        return w.toString();
    }

    private String cleanXmlResponse(String raw) {
        if (raw == null) return "";
        String c = raw.trim();
        if (c.startsWith("```")) {
            c = c.replaceFirst("```(xml)?\\s*", "");
            int last = c.lastIndexOf("```");
            if (last != -1) c = c.substring(0, last).trim();
        }
        return c;
    }

    private String callGroq(String userPrompt, String systemPrompt) throws Exception {
        Map<String, Object> body = Map.of("model", MODEL, "messages", List.of(Map.of("role", "system", "content", systemPrompt), Map.of("role", "user", "content", userPrompt)), "temperature", 0.1);
        String res = restClient.post().uri(GROQ_URL).header("Authorization", "Bearer " + apiKey).header("Content-Type", "application/json").body(body).retrieve().body(String.class);
        return objectMapper.readTree(res).path("choices").get(0).path("message").path("content").asText().trim();
    }

    private record FlowInfo(String id, String sourceRef, String targetRef, String name) {}
}
