package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.UserDevice;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface UserDeviceRepository extends MongoRepository<UserDevice, String> {
    Optional<UserDevice> findByUserId(String userId);
}
