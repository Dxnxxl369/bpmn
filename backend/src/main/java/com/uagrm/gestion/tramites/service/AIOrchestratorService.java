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
import com.uagrm.gestion.tramites.model.PoliticaNegocio;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIOrchestratorService {

    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${groq.api.key}")
    private String apiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";

    public List<Map<String, String>> discoverProcesses(String input, String mode) {
        String systemPrompt = """
            Eres un Arquitecto de Procesos Senior. Tu tarea es analizar el contenido e identificar todos los procesos de negocio descritos.
            REGLAS:
            1. Devuelve un ARRAY JSON: [{"nombre": "...", "fragmento": "..."}].
            2. "fragmento": Es el texto original EXACTO (párrafo completo) de origen para ese proceso.
            3. Salida EXCLUSIVA: JSON puro.
            """;
        
        String userPrompt = String.format("Modo: %s. Contenido:\\n%s", mode, input.length() > 8000 ? input.substring(0, 8000) : input);
        
        try {
            String raw = callGroq(userPrompt, systemPrompt);
            String cleaned = cleanResponseUniversal(raw);
            JsonNode node = objectMapper.readTree(cleaned);
            List<Map<String, String>> result = new ArrayList<>();
            if (node.isArray()) {
                for (JsonNode item : node) {
                    Map<String, String> m = new HashMap<>();
                    m.put("nombre", item.path("nombre").asText("Proceso Nuevo"));
                    m.put("fragmento", item.path("fragmento").asText(input));
                    result.add(m);
                }
            } else {
                Map<String, String> m = new HashMap<>();
                m.put("nombre", node.path("nombre").asText("Proceso Nuevo"));
                m.put("fragmento", node.path("fragmento").asText(input));
                result.add(m);
            }
            return result;
        } catch (Exception e) {
            log.error("Error en descubrimiento", e);
            return List.of(Map.of("nombre", "Proceso Detectado", "fragmento", input));
        }
    }

    public String generatePureUmlXml(String processName, String fragment) {
        String systemPrompt = """
            Eres un Ingeniero de Software experto en UML 2.5. Tu ÚNICA tarea es generar el XML de un Activity Diagram.
            
            ESQUEMA XML REQUERIDO (Usa exactamente estas etiquetas):
            <uml:Activity xmlns:uml="http://www.omg.org/spec/UML/20131001" id="Activity_1" name="NOMBRE">
              <uml:ActivityPartition id="P1" name="Departamento">
                <uml:nodeRef>N1</uml:nodeRef>
              </uml:ActivityPartition>
              <uml:InitialNode id="Start" name="Inicio"><uml:outgoing>F1</uml:outgoing></uml:InitialNode>
              <uml:OpaqueAction id="N1" name="Tarea"><uml:incoming>F1</uml:incoming><uml:outgoing>F2</uml:outgoing></uml:OpaqueAction>
              <uml:ActivityFinalNode id="End" name="Fin"><uml:incoming>F2</uml:incoming></uml:ActivityFinalNode>
              <uml:ControlFlow id="F1" sourceRef="Start" targetRef="N1"/>
            </uml:Activity>

            REGLAS:
            1. Cada actor o departamento es una <uml:ActivityPartition>.
            2. Si el actor es EXTERNO (ej. Cliente, Solicitante, Ciudadano, Paciente), DEBES añadir isExternal="true" a su partición. Ejemplo: <uml:ActivityPartition id="P1" name="CLIENTE" isExternal="true">
            3. Todos los nodos deben estar dentro de una partición via <uml:nodeRef>.
            4. Salida EXCLUSIVA: XML puro.
            """;

        String userPrompt = String.format("Genera el XML UML 2.5 para el proceso '%s' basado en este fragmento:\\n%s", processName, fragment);

        try {
            String raw = callGroq(userPrompt, systemPrompt);
            return repairSemanticXml(cleanXmlResponse(raw));
        } catch (Exception e) {
            log.error("Error en generación de XML puro", e);
            return "";
        }
    }

    public String generateBPMNXml(String processName, String fullContextText) {
        return generatePureUmlXml(processName, fullContextText);
    }

    public Map<String, String> triage(String userMessage, List<PoliticaNegocio> politicas) {
        StringBuilder context = new StringBuilder("Lista de Trámites Disponibles:\\n");
        for (PoliticaNegocio p : politicas) {
            context.append(String.format("- ID: %s | Nombre: %s | Descripción: %s | Fragmento: %s\\n", 
                p.getId(), p.getNombre(), p.getDescripcion(), p.getOrigenContenido()));
        }

        String systemPrompt = """
            Eres el Orientador Virtual de la UAGRM. Tu función es hablar DIRECTAMENTE con el ciudadano para recomendarle un trámite.
            
            REGLAS DE TONO Y ESTILO:
            1. Diríjase al usuario siempre de "Usted" (Ej: "Le sugerimos...", "Basado en su necesidad...").
            2. Sea BREVE, FORMAL y CORDIAL. 
            3. Hable como si el software estuviera conversando con la persona.
            4. PROHIBIDO usar términos técnicos como "fragmento", "política", "id", "prompt" o "sistema". Refiérase a ellos como "trámites" o "servicios".
            
            REGLAS DE FORMATO:
            1. Responde ÚNICAMENTE en formato JSON: {"politicaId": "...", "razon": "..."}.
            2. "politicaId": El ID del trámite más adecuado.
            3. "razon": El mensaje directo para el ciudadano (Ej: "Le sugerimos el trámite de Diversión para que pueda gestionar su ingreso al cine de forma correcta").
            4. Salida EXCLUSIVA: JSON puro.
            """;

        try {
            String raw = callGroq("Mensaje del Usuario: " + userMessage + "\\n\\n" + context.toString(), systemPrompt);
            String cleaned = cleanResponseUniversal(raw);
            JsonNode node = objectMapper.readTree(cleaned);
            Map<String, String> res = new HashMap<>();
            res.put("politicaId", node.path("politicaId").isNull() ? null : node.path("politicaId").asText());
            res.put("razon", node.path("razon").asText("No pude determinar el trámite exacto."));
            return res;
        } catch (Exception e) {
            log.error("Error en Triage IA", e);
            return Map.of("politicaId", "null", "razon", "Error interno al procesar la solicitud.");
        }
    }

    private String cleanResponseUniversal(String raw) {
        if (raw == null) return "";
        String clean = raw.trim();
        
        // 1. Eliminar bloques markdown
        if (clean.contains("```")) {
            int first = clean.indexOf("```");
            int last = clean.lastIndexOf("```");
            if (last > first) {
                String inside = clean.substring(first + 3, last).trim();
                if (inside.startsWith("json")) inside = inside.substring(4).trim();
                if (inside.startsWith("xml")) inside = inside.substring(3).trim();
                clean = inside;
            }
        }
        
        // 2. Si es XML, extraer solo el bloque <...>
        if (clean.contains("<") && clean.contains(">")) {
            int start = clean.indexOf("<");
            int end = clean.lastIndexOf(">");
            if (end > start) return clean.substring(start, end + 1);
        }
        
        // 3. Si es JSON, extraer solo el bloque {...} o [...]
        if (clean.contains("{") || clean.contains("[")) {
            int start = Math.min(
                clean.indexOf("{") == -1 ? Integer.MAX_VALUE : clean.indexOf("{"),
                clean.indexOf("[") == -1 ? Integer.MAX_VALUE : clean.indexOf("[")
            );
            int end = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
            if (start != Integer.MAX_VALUE && end != -1 && end > start) {
                return clean.substring(start, end + 1);
            }
        }
        
        return clean.trim();
    }

    public String repairSemanticXml(String xml) {
        if (xml == null || !xml.contains("<")) return "";
        try {
            Document doc = parseXml(xml);
            Element root = doc.getDocumentElement();

            // 1. Obtener todos los IDs de nodos reales definidos en el XML
            Set<String> realNodeIds = new HashSet<>();
            String[] tags = {"InitialNode", "ActivityFinalNode", "OpaqueAction", "DecisionNode", "ForkNode", "JoinNode", "FlowFinalNode"};
            for (String tag : tags) {
                NodeList nl = doc.getElementsByTagNameNS("*", tag);
                if (nl.getLength() == 0) nl = doc.getElementsByTagName(tag);
                for (int i = 0; i < nl.getLength(); i++) {
                    String id = ((Element) nl.item(i)).getAttribute("id");
                    if (!id.isEmpty()) realNodeIds.add(id);
                }
            }

            // 2. Obtener todos los IDs que ya están referenciados en alguna partición
            Set<String> referencedIds = new HashSet<>();
            NodeList refs = doc.getElementsByTagNameNS("*", "nodeRef");
            if (refs.getLength() == 0) refs = doc.getElementsByTagName("nodeRef");
            for (int i = 0; i < refs.getLength(); i++) {
                referencedIds.add(refs.item(i).getTextContent().trim());
            }

            // 3. Encontrar nodos huérfanos
            Set<String> orphans = new HashSet<>(realNodeIds);
            orphans.removeAll(referencedIds);

            // 4. Adoptar huérfanos en la primera partición disponible
            if (!orphans.isEmpty()) {
                NodeList partitions = doc.getElementsByTagNameNS("*", "ActivityPartition");
                if (partitions.getLength() == 0) partitions = doc.getElementsByTagName("ActivityPartition");
                
                if (partitions.getLength() > 0) {
                    Element firstLane = (Element) partitions.item(0);
                    for (String orphanId : orphans) {
                        log.info("Backend Reparador: Adoptando nodo huérfano {} en la partición {}", orphanId, firstLane.getAttribute("name"));
                        Element nodeRef = doc.createElement("uml:nodeRef");
                        nodeRef.setTextContent(orphanId);
                        firstLane.appendChild(nodeRef);
                    }
                }
            }

            return serializeDoc(doc);
        } catch (Exception e) {
            log.warn("XML mal formado en reparación, intentando limpieza básica: {}", e.getMessage());
            int start = xml.indexOf("<");
            int end = xml.lastIndexOf(">");
            return (start != -1 && end > start) ? xml.substring(start, end + 1) : xml;
        }
    }

    public String analyzeBottlenecks(String xmlUml) {
        String systemPrompt = "Eres un Consultor Lean Six Sigma experto. Analiza el XML UML y genera 4 secciones: ## Cuellos de Botella, ## Tiempos, ## Puntos de Atasco, ## Recomendaciones.";
        try { return callGroq("Analiza:\n" + xmlUml, systemPrompt); } catch (Exception e) { return "Error"; }
    }

    public String editBPMNXml(String xmlActual, String instruccion) {
        String systemPrompt = "Eres un arquitecto experto en UML 2.5. Aplica el cambio solicitado en el diagrama de actividades sin alterar IDs existentes. Devuelve el XML completo sin markdown.";
        try { return repairSemanticXml(cleanXmlResponse(callGroq("XML:\n" + xmlActual + "\nInstrucción: " + instruccion, systemPrompt))); } catch (Exception e) { return xmlActual; }
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
        String clean = raw.trim();
        
        // 1. Limpiar bloques de código markdown
        if (clean.contains("```")) {
            // Extraer lo que hay entre las primeras ``` y las últimas ```
            int first = clean.indexOf("```");
            int last = clean.lastIndexOf("```");
            if (first != -1 && last > first) {
                // Saltar la etiqueta del lenguaje (xml, json, etc)
                String inside = clean.substring(first + 3, last);
                if (inside.startsWith("xml")) inside = inside.substring(3);
                if (inside.startsWith("json")) inside = inside.substring(4);
                clean = inside.trim();
            } else {
                clean = clean.replaceAll("```[a-z]*", "").replaceAll("```", "").trim();
            }
        }
        
        // 2. Si es XML (empieza con <), extraer solo el bloque XML
        if (clean.startsWith("<")) {
            int start = clean.indexOf("<");
            int end = clean.lastIndexOf(">");
            if (start != -1 && end > start) return clean.substring(start, end + 1);
        }
        
        // 3. Si es JSON (empieza con { o [), devolver tal cual
        return clean.trim();
    }

    private String callGroq(String userPrompt, String systemPrompt) throws Exception {
        int maxRetries = 3;
        int delay = 1000;
        
        for (int i = 0; i < maxRetries; i++) {
            try {
                Map<String, Object> body = Map.of(
                    "model", MODEL, 
                    "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt), 
                        Map.of("role", "user", "content", userPrompt)
                    ), 
                    "temperature", 0.1
                );
                
                String res = restClient.post()
                        .uri(GROQ_URL)
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", "application/json")
                        .body(body)
                        .retrieve()
                        .body(String.class);
                        
                return objectMapper.readTree(res).path("choices").get(0).path("message").path("content").asText().trim();
            } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
                log.warn("Rate limit alcanzado en Groq (429). Reintento {} de {} en {}ms", i + 1, maxRetries, delay);
                Thread.sleep(delay);
                delay *= 2; // Backoff exponencial
            }
        }
        throw new RuntimeException("Error persistente 429 en Groq tras reintentos.");
    }
}
