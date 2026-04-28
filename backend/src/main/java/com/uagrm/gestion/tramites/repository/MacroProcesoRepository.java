package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.MacroProceso;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MacroProcesoRepository extends MongoRepository<MacroProceso, String> {
}
