package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.PoliticaNegocio;
import com.uagrm.gestion.tramites.model.EstadoPolitica;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface PoliticaNegocioRepository extends MongoRepository<PoliticaNegocio, String> {
    List<PoliticaNegocio> findByEstado(EstadoPolitica estado);
}
