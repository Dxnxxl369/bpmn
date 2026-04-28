package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.MacroProcesoPaso;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MacroProcesoPasoRepository extends MongoRepository<MacroProcesoPaso, String> {
    List<MacroProcesoPaso> findByMacroprocesoIdAndPoliticaOrigenIdAndEventoSalidaId(
        String macroprocesoId, String politicaOrigenId, String eventoSalidaId);
}
