package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.Departamento;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface DepartamentoRepository extends MongoRepository<Departamento, String> {
    Optional<Departamento> findByNombreOriginal(String nombreOriginal);
}
