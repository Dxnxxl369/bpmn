package com.uagrm.gestion.tramites.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;

import com.google.firebase.messaging.*;

@Service
public class PushNotificationService {

    @PostConstruct
    public void initialize() {
        try {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(new ClassPathResource("serviceAccountKey.json").getInputStream()))
                    .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
            }
        } catch (IOException e) {
            System.err.println("Error inicializando Firebase: " + e.getMessage());
        }
    }

    public void sendPushNotification(String fcmToken, String title, String body, String colorHex) {
        if (fcmToken == null || fcmToken.isBlank()) {
            System.err.println("âŒ [PUSH-DEBUG] Error: Token vacÃ­o. No se puede enviar notificaciÃ³n.");
            return;
        }

        System.out.println("ðŸš€ [PUSH-DEBUG] INTENTANDO ENVIAR A TOKEN: " + fcmToken.substring(0, Math.min(fcmToken.length(), 20)) + "...");
        System.out.println("ðŸ“¬ [PUSH-DEBUG] TÃTULO: " + title + " | CUERPO: " + body);

        try {
            AndroidNotification androidNotification = AndroidNotification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .setColor(colorHex != null ? colorHex : "#007BFF")
                    .setSound("default")
                    .setPriority(AndroidNotification.Priority.HIGH)
                    .build();

            Message message = Message.builder()
                    .setToken(fcmToken)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setNotification(androidNotification)
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .build())
                    .build();

            String response = FirebaseMessaging.getInstance().send(message);
            System.out.println("âœ… [PUSH-DEBUG] Ã‰XITO: NotificaciÃ³n enviada. ID: " + response);
        } catch (Exception e) {
            System.err.println("âŒ [PUSH-DEBUG] ERROR FIREBASE: " + e.getMessage());
            e.printStackTrace();
        }
    }


    public void sendPushNotification(String fcmToken, String title, String body) {
        sendPushNotification(fcmToken, title, body, "#007BFF");
    }
}

