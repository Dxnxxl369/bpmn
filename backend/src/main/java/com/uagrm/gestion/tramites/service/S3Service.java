package com.uagrm.gestion.tramites.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ObjectCannedACL;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.InputStream;
import java.util.UUID;

@Service
@Slf4j
public class S3Service {

    private final S3Client s3Client;
    private final String bucketName;
    private final String region;

    public S3Service(
            @Value("${aws.accessKey}") String accessKey,
            @Value("${aws.secretKey}") String secretKey,
            @Value("${aws.region}") String region,
            @Value("${aws.bucketName}") String bucketName) {
        
        this.bucketName = bucketName;
        this.region = region;
        
        this.s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();
        
        log.info("S3 Service inicializado en region: {}", region);
    }

    public String subirArchivo(String nombreOriginal, InputStream inputStream, long size, String contentType) {
        String key = "tramites/" + UUID.randomUUID() + "_" + nombreOriginal;
        return subirArchivoConKey(key, inputStream, size, contentType);
    }

    public String subirArchivoConKey(String key, InputStream inputStream, long size, String contentType) {
        System.out.println(">> [S3-Service] Iniciando transferencia a bucket: " + bucketName + " Key: " + key);
        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(inputStream, size));
            System.out.println(">> [S3-Service] SDK reporta Ã©xito.");
            return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, key);
        } catch (Exception e) {
            System.err.println("âŒ [S3-Service] Fallo interno SDK: " + e.getMessage());
            throw new RuntimeException("Error en almacenamiento S3: " + e.getMessage());
        }
    }


    /**
     * Descarga un archivo desde S3 basándose en su URL pública o Key.
     */
    public byte[] descargarArchivo(String urlS3) {
        try {
            // Extraer la Key de la URL (asumiendo formato estándar de AWS)
            // URL: https://bucket.s3.region.amazonaws.com/tramites/uuid_nombre.ext
            String key = urlS3.substring(urlS3.lastIndexOf(".com/") + 5);
            
            return s3Client.getObjectAsBytes(req -> req.bucket(bucketName).key(key)).asByteArray();
        } catch (Exception e) {
            log.error("❌ [S3-Service] Error al descargar de S3: {}", e.getMessage());
            return null;
        }
    }
}
