package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.FormularioSchema;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface FormularioSchemaRepository extends MongoRepository<FormularioSchema, String> {
    List<FormularioSchema> findByPoliticaId(String politicaId);
    
    // Al guardar en minúsculas en el modelo, estas búsquedas funcionarán siempre que el parámetro se pase en minúsculas
    Optional<FormularioSchema> findByPoliticaIdAndTaskDefinitionId(String politicaId, String taskDefinitionId);
    
    void deleteByPoliticaId(String politicaId);
}
