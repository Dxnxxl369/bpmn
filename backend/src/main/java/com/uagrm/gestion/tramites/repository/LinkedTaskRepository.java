package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.LinkedTask;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface LinkedTaskRepository extends MongoRepository<LinkedTask, String> {
    List<LinkedTask> findByUserId(String userId);
    List<LinkedTask> findByProcessInstanceId(String processInstanceId);
}
