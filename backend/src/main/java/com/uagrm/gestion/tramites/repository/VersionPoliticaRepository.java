package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.VersionPolitica;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VersionPoliticaRepository extends MongoRepository<VersionPolitica, String> {
    List<VersionPolitica> findByPoliticaNegocioIdOrderByVersionDesc(String politicaNegocioId);

    // En Mongo, para el MAX usaremos el service o un findFirstBy...
    VersionPolitica findFirstByPoliticaNegocioIdOrderByVersionDesc(String politicaId);
}
