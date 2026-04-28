package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.EstadisticaTarea;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EstadisticaTareaRepository extends MongoRepository<EstadisticaTarea, String> {
    List<EstadisticaTarea> findByPoliticaNegocioId(String politicaNegocioId);
    List<EstadisticaTarea> findByPoliticaNegocioIdAndTaskDefinitionId(String politicaNegocioId, String taskDefinitionId);
}
