package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.TareaInstancia;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface TareaInstanciaRepository extends MongoRepository<TareaInstancia, String> {
    List<TareaInstancia> findByLaneIdAndEstado(String laneId, String estado);
    List<TareaInstancia> findByLaneIdInAndEstado(List<String> laneIds, String estado);
    List<TareaInstancia> findByInstanciaProcesoId(String instanciaProcesoId);
    List<TareaInstancia> findByInstanciaProcesoIdAndEstado(String instanciaProcesoId, String estado);
}
