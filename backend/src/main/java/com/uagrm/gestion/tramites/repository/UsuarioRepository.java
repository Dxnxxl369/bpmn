package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.Usuario;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;
import java.util.List;

public interface UsuarioRepository extends MongoRepository<Usuario, String> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByCi(String ci);
    List<Usuario> findByRol(String rol);
}
