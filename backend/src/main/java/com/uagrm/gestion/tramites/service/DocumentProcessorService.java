package com.uagrm.gestion.tramites.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
public class DocumentProcessorService {

    /**
     * Extrae el texto completo de un archivo PDF usando Apache PDFBox.
     * @param file Archivo PDF subido por el usuario.
     * @return Texto extraído del documento.
     * @throws IOException Si ocurre un error al procesar el archivo.
     */
    public String extractTextFromPdf(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("El archivo está vacío.");
        }

        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            
            if (text == null || text.trim().isEmpty()) {
                throw new IOException("No se pudo extraer texto del PDF (posiblemente basado en imágenes).");
            }
            
            return text;
        }
    }
}
