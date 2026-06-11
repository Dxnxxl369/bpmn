package com.uagrm.gestion.tramites.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uagrm.gestion.tramites.model.Documento;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.Word;
import net.sourceforge.tess4j.ITessAPI.TessPageIteratorLevel;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@Slf4j
public class VisionService {

    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${groq.api.key}")
    private String apiKey;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    @Value("${hf.api.key}")
    private String hfApiKey;

    private static final String HF_API_URL = "https://api-inference.huggingface.co/models/impira/layoutlm-document-qa";
    private static final String PYTHON_SIDECAR_URL = "http://localhost:5000/process";
    private static final String PYTHON_PDF_URL = "http://localhost:5000/html-to-pdf";
    private static final String MODELO_VISION = "meta-llama/llama-4-scout-17b-16e-instruct";

    public byte[] convertHtmlToPdf(String htmlContent) {
        log.info(">> [IA-PDF-SIDECAR] Convirtiendo HTML a PDF via Python...");
        try {
            Map<String, String> body = Map.of("html", htmlContent);
            String response = restClient.post()
                .uri(PYTHON_PDF_URL)
                .header("Content-Type", "application/json")
                .body(body).retrieve().body(String.class);
            
            String b64 = objectMapper.readTree(response).path("pdf_base64").asText();
            return Base64.getDecoder().decode(b64);
        } catch (Exception e) {
            log.error("âŒ [IA-PDF-SIDECAR] Error en conversiÃ³n PDF: {}", e.getMessage());
            return null;
        }
    }

    public String extraerTextoArchivo(byte[] content, String fileName) {
        String name = fileName.toLowerCase();
        log.info(">> [IA-VISION-DEBUG] Extrayendo texto local de: {}", fileName);
        try {
            if (name.endsWith(".pdf")) {
                try (PDDocument doc = Loader.loadPDF(content)) {
                    return new PDFTextStripper().getText(doc);
                }
            } else if (name.endsWith(".txt")) {
                return new String(content, StandardCharsets.UTF_8);
            } else if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
                return analizarTextoImagen(content);
            }
        } catch (Exception e) {
            log.error("❌ [IA-VISION-DEBUG] Error extrayendo texto: {}", e.getMessage());
        }
        return "";
    }

    private String analizarTextoImagen(byte[] imageBytes) {
        try {
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String prompt = "Extrae todo el texto de esta imagen. Devuelve solo el texto plano.";
            return callVisionApi(base64Image, prompt, false);
        } catch (Exception e) {
            return "";
        }
    }

    public List<Documento.OcrCoordinate> analizarImagenReal(byte[] imageBytes, String tipoDocumento) {
        log.info(">> [IA-VISION] Analizando imagen real para {}...", tipoDocumento);
        try {
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String prompt = "Extrae texto y coordenadas precisas en escala 0-1000. JSON: {ocr: [{texto, x, y, w, h}]}.";
            String json = callVisionApi(base64Image, prompt, false);
            List<Documento.OcrCoordinate> aiGuesses = parseOcrCoordinates(cleanJsonResponse(json));
            
            List<Documento.OcrCoordinate> localMap = getLocalOcrWordMap(imageBytes);
            return linkAiWithLocalPrecision(aiGuesses, localMap);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public List<Documento.OcrCoordinate> obtenerCoordenadasDirigidas(byte[] imageBytes, List<String> terminos) {
        log.info(">> [IA-PRECISION-SIDECAR] Consultando Servidor de Visión Local (Python)...");
        
        List<Documento.OcrCoordinate> localDeepMap = new ArrayList<>();
        try {
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            Map<String, String> body = Map.of("image", base64Image);
            String response = restClient.post()
                .uri(PYTHON_SIDECAR_URL)
                .header("Content-Type", "application/json")
                .body(body).retrieve().body(String.class);
            localDeepMap = parseOcrCoordinates(response);
            log.info(">> [VISION-SIDECAR] Recibidas {} coordenadas de Deep Learning.", localDeepMap.size());
        } catch (Exception e) {
            log.warn("⚠️ [VISION-SIDECAR] Servidor Python no disponible. Usando fallback Tesseract.");
            localDeepMap = getLocalOcrWordMap(imageBytes);
        }

        List<Documento.OcrCoordinate> finalCoords = new ArrayList<>();
        for (String term : terminos) {
            if (term == null || term.length() < 2 || term.equals("null")) continue;

            Documento.OcrCoordinate bestMatch = findBestTextMatch(term, localDeepMap);
            if (bestMatch != null) {
                log.info("✅ [PRECISION-MATCH] Encontrado '{}' -> X:{} Y:{}", term, bestMatch.getX(), bestMatch.getY());
                finalCoords.add(bestMatch);
            }
        }
        return finalCoords;
    }

    private Documento.OcrCoordinate findBestTextMatch(String fragmento, List<Documento.OcrCoordinate> map) {
        String cleanFragment = normalizeText(fragmento);
        Documento.OcrCoordinate best = null;
        int bestScore = 0;

        for (Documento.OcrCoordinate local : map) {
            String localText = normalizeText(local.getTexto());
            if (localText.length() < 2) continue;

            if (cleanFragment.contains(localText) || localText.contains(cleanFragment)) {
                int score = localText.length();
                if (score > bestScore) {
                    bestScore = score;
                    best = local;
                }
            }
        }
        return best;
    }

    private List<Documento.OcrCoordinate> getLocalOcrWordMap(byte[] imageBytes) {
        List<Documento.OcrCoordinate> map = new ArrayList<>();
        ITesseract tesseract = new Tesseract();
        tesseract.setDatapath("C:/tessdata"); 
        tesseract.setLanguage("spa+eng");
        
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (image == null) return map;
            int imgW = image.getWidth();
            int imgH = image.getHeight();
            List<Word> words = tesseract.getWords(image, TessPageIteratorLevel.RIL_WORD);
            for (Word w : words) {
                java.awt.Rectangle rect = w.getBoundingBox();
                int x = (rect.x * 1000) / imgW;
                int y = (rect.y * 1000) / imgH;
                int width = (rect.width * 1000) / imgW;
                int height = (rect.height * 1000) / imgH;
                map.add(new Documento.OcrCoordinate(w.getText(), x, y, width, height));
            }
        } catch (Exception | Error e) {
            log.warn("⚠️ [LOCAL-OCR] Fallo Tesseract.");
        }
        return map;
    }

    private List<Documento.OcrCoordinate> linkAiWithLocalPrecision(List<Documento.OcrCoordinate> aiGuesses, List<Documento.OcrCoordinate> localMap) {
        if (localMap.isEmpty()) return aiGuesses;
        List<Documento.OcrCoordinate> finalCoords = new ArrayList<>();
        for (Documento.OcrCoordinate ai : aiGuesses) {
            String aiText = normalizeText(ai.getTexto());
            if (aiText.length() < 2 || aiText.equals("null")) continue;
            Documento.OcrCoordinate bestMatch = null;
            double minDistance = Double.MAX_VALUE;
            for (Documento.OcrCoordinate local : localMap) {
                String localText = normalizeText(local.getTexto());
                if (localText.length() < 2) continue;
                if (aiText.contains(localText) || localText.contains(aiText)) {
                    double dist = Math.sqrt(Math.pow(ai.getX() - local.getX(), 2) + Math.pow(ai.getY() - local.getY(), 2));
                    if (dist < minDistance && dist < 200) { 
                        minDistance = dist;
                        bestMatch = local;
                    }
                }
            }
            if (bestMatch != null) {
                if (bestMatch.getTexto().length() < 3 && !aiText.equals(normalizeText(bestMatch.getTexto()))) continue; 
                finalCoords.add(new Documento.OcrCoordinate(ai.getTexto(), bestMatch.getX(), bestMatch.getY(), Math.max(bestMatch.getW(), ai.getW()), bestMatch.getH()));
            } else if (aiText.length() > 2) {
                finalCoords.add(ai);
            }
        }
        return finalCoords;
    }

    private String normalizeText(String text) {
        if (text == null) return "";
        return text.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private String callVisionApi(String base64Image, String prompt, boolean isJson) throws Exception {
        Map<String, Object> body = Map.of(
            "model", MODELO_VISION,
            "messages", List.of(Map.of("role", "user", "content", List.of(
                Map.of("type", "text", "text", prompt),
                Map.of("type", "image_url", "image_url", Map.of("url", "data:image/jpeg;base64," + base64Image))
            ))),
            "temperature", 0.0,
            "response_format", isJson ? Map.of("type", "json_object") : Map.of("type", "text")
        );
        String res = restClient.post().uri(GROQ_URL).header("Authorization", "Bearer " + apiKey).header("Content-Type", "application/json").body(body).retrieve().body(String.class);
        return objectMapper.readTree(res).path("choices").get(0).path("message").path("content").asText().trim();
    }

    private String cleanJsonResponse(String raw) {
        if (raw == null || raw.isBlank()) return "{}";
        String result = raw.trim();
        if (result.contains("```")) {
            int start = result.indexOf("```");
            int firstNewLine = result.indexOf("\n", start);
            if (firstNewLine == -1) firstNewLine = start + 3;
            int end = result.lastIndexOf("```");
            if (end > firstNewLine) result = result.substring(firstNewLine, end).trim();
        }
        if (!result.startsWith("{")) {
            int firstBrace = result.indexOf("{");
            int lastBrace = result.lastIndexOf("}");
            if (firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace) result = result.substring(firstBrace, lastBrace + 1).trim();
        }
        return result;
    }

    private List<Documento.OcrCoordinate> parseOcrCoordinates(String json) {
        List<Documento.OcrCoordinate> coords = new ArrayList<>();
        try {
            JsonNode node = objectMapper.readTree(json);
            JsonNode arrayNode = node.has("ocr") ? node.get("ocr") : (node.isArray() ? node : node);
            if (arrayNode.isArray()) {
                for (JsonNode item : arrayNode) {
                    coords.add(new Documento.OcrCoordinate(item.path("texto").asText(), item.path("x").asInt(), item.path("y").asInt(), item.path("w").asInt(), item.path("h").asInt()));
                }
            }
        } catch (Exception e) {}
        return coords;
    }

    public String extraerTextoCompleto(List<Documento.OcrCoordinate> coords) {
        if (coords == null || coords.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (Documento.OcrCoordinate c : coords) {
            if (!"FALLO_VISION_REAL".equals(c.getTexto())) sb.append(c.getTexto()).append(" ");
        }
        return sb.toString().trim();
    }
}
