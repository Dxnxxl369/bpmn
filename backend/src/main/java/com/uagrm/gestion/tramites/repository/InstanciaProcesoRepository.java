package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.InstanciaProceso;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface InstanciaProcesoRepository extends MongoRepository<InstanciaProceso, String> {
    List<InstanciaProceso> findByEstado(String estado);
    java.util.Optional<InstanciaProceso> findByCodigoSeguimiento(String codigoSeguimiento);
}
