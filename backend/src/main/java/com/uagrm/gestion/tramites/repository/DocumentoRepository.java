package com.uagrm.gestion.tramites.repository;

import com.uagrm.gestion.tramites.model.Documento;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentoRepository extends MongoRepository<Documento, String> {
    List<Documento> findByClienteCi(String clienteCi);
    List<Documento> findByInstanciaId(String instanciaId);
    List<Documento> findByClienteCiAndTipoDocumento(String clienteCi, String tipoDocumento);
    Optional<Documento> findByInstanciaIdAndTipoDocumentoAndEsActualTrue(String instanciaId, String tipoDocumento);
    List<Documento> findByInstanciaIdAndTipoDocumentoOrderByVersionDesc(String instanciaId, String tipoDocumento);
    List<Documento> findByClienteCiAndTipoDocumentoOrderByVersionDesc(String clienteCi, String tipoDocumento);
    Optional<Documento> findByInstanciaIdAndNombreArchivoAndEsActualTrue(String instanciaId, String nombreArchivo);
    List<Documento> findByInstanciaIdAndEsColaborativoTrueAndEsActualTrue(String instanciaId);
    List<Documento> findAllByDocumentoPadreIdOrIdOrderByVersionDesc(String padreId, String id);
}
