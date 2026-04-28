package com.uagrm.gestion.tramites.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "user_devices")
public class UserDevice {
    @Id
    private String id;
    private String userId;
    private String fcmToken;
}
