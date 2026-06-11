package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.AuditoriaLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface AuditoriaLogRepository extends MongoRepository<AuditoriaLog, String> {
    List<AuditoriaLog> findAllByOrderByTimestampDesc();
    List<AuditoriaLog> findByEntidadIdOrderByTimestampDesc(String entidadId);
    List<AuditoriaLog> findByUsuarioIdOrderByTimestampDesc(String usuarioId);
}
