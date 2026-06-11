import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface PoliticaNegocio {
  id?: string;
  nombre: string;
  descripcion: string;
  xmlBpmn: string;
  estado: string;
  ultimaModificacion: string;
  origenTipo?: string;        // PDF, PROMPT, VOZ
  origenContenido?: string;   // Texto del prompt o fragmento del PDF
  documentoOrigenId?: string; // Enlace al documento en S3/DMS
}

export interface UsuarioEjecutivo {
  id: string;
  nombre: string;
  email: string;
  avatar?: string;
  departamentoIds?: string[];
}

export interface Departamento {
  id?: string;
  nombreOriginal: string;
  nombreNormalizado: string;
}

@Injectable({
  providedIn: 'root'
})
export class BpmsService {
  private apiUrl = 'http://localhost:8080/api/politicas';
  private publicUrl = 'http://localhost:8080/api/public/servicios';
  private usrUrl = 'http://localhost:8080/api/usuarios';
  private deptUrl = 'http://localhost:8080/api/departamentos';
  private apiUrlForm = 'http://localhost:8080/api/formulario';

  constructor(private http: HttpClient, private authService: AuthService) {}

  listarPoliticasPublicas(): Observable<PoliticaNegocio[]> {
    return this.http.get<PoliticaNegocio[]>(this.publicUrl);
  }

  listarTareasPoliticaPublicas(id: string): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8080/api/public/politica/${id}/tareas`);
  }

  generarFormularioPublico(politicaId: string, taskId: string, instanciaId?: string): Observable<string> {
    return this.http.get(`http://localhost:8080/api/public/formulario`, {
      params: { politicaId, taskId, instanciaId: instanciaId || '' },
      responseType: 'text'
    });
  }

  verificarEstadoTramite(clienteCi: string, politicaId: string): Observable<any> {
    return this.http.get(`http://localhost:8080/api/public/verificar-estado`, {
      params: { clienteCi, politicaId }
    });
  }

  enviarSubsanacion(instanciaId: string, respuestas: string): Observable<any> {
    return this.http.post(`http://localhost:8080/api/public/subsanar-enviar`, { instanciaId, respuestas });
  }

  solicitarSubsanacion(tareaId: string, observaciones: any): Observable<any> {
    return this.http.post(`http://localhost:8080/api/instancias/tareas/${tareaId}/solicitar-subsanacion`, observaciones);
  }

  listarPoliticas(): Observable<PoliticaNegocio[]> {
    return this.http.get<PoliticaNegocio[]>(this.apiUrl);
  }

  crearPolitica(politica: PoliticaNegocio): Observable<PoliticaNegocio> {
    return this.http.post<PoliticaNegocio>(this.apiUrl, politica);
  }

  activarPolitica(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/activar`, {});
  }

  actualizarPolitica(id: string, politica: PoliticaNegocio): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, politica);
  }

  archivarPolitica(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/archivar`, {});
  }

  guardarDiagrama(id: string, xmlBpmn: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/xml`, xmlBpmn);
  }

  analizarCuellosBotella(xml: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/analizar-cuellos`, { xml });
  }

  editarConIA(id: string, instruccion: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/editar-con-ia`, { instruccion });
  }

  procesarDocumento(file: File): Observable<PoliticaNegocio[]> {
    const formData = new FormData();
    formData.append('archivo', file);
    return this.http.post<PoliticaNegocio[]>(`${this.apiUrl}/procesar-documento`, formData);
  }

  procesarTextoManual(texto: string): Observable<PoliticaNegocio[]> {
    return this.http.post<PoliticaNegocio[]>(`${this.apiUrl}/texto`, { texto });
  }

  listarDepartamentos(): Observable<Departamento[]> {
    return this.http.get<Departamento[]>(this.deptUrl);
  }

  resincronizarDepartamentos(): Observable<any> {
    return this.http.post(`${this.apiUrl}/resincronizar-todo`, {});
  }

  guardarDepartamento(dept: any): Observable<any> {
    return this.http.post(this.deptUrl, dept);
  }

  listarEjecutivos(): Observable<UsuarioEjecutivo[]> {
    return this.http.get<UsuarioEjecutivo[]>(`${this.usrUrl}/ejecutivos`);
  }

  getMiPerfil(email: string): Observable<any> {
    return this.http.get<any>(`${this.usrUrl}/me?email=${email}`);
  }

  asignarDepartamentos(usuarioId: string, departamentoIds: string[]): Observable<any> {
    return this.http.put(`${this.usrUrl}/${usuarioId}/departamentos`, departamentoIds);
  }

  getTareasPendientes(laneId: string | string[]): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8080/api/instancias/tareas/pendientes`, {
      params: { laneId }
    });
  }

  getTareasEnProceso(laneId: string | string[]): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8080/api/instancias/tareas/en-proceso`, {
      params: { laneId }
    });
  }

  getTareasCompletadas(laneId: string | string[]): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8080/api/instancias/tareas/completadas`, {
      params: { laneId }
    });
  }

  completarTarea(tareaId: string, respuestas: any): Observable<any> {
    return this.http.post(`http://localhost:8080/api/instancias/tareas/${tareaId}/completar`, respuestas);
  }

  atenderTarea(tareaId: string, userEmail: string): Observable<any> {
    return this.http.post(`http://localhost:8080/api/instancias/tareas/${tareaId}/atender`, null, {
      params: { userEmail }
    });
  }

  generarFormulario(politicaId: string, taskId: string): Observable<string> {
    return this.http.get(`${this.apiUrlForm}/generar`, {
      params: { politicaId, taskId },
      responseType: 'text'
    });
  }

  listarTareasPolitica(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrlForm}/politica/${id}/tareas`);
  }

  generarFormularioIA(politicaId: string, taskId: string, taskName: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrlForm}/politica/${politicaId}/tarea/${taskId}/generar?taskName=${taskName}`, {});
  }

  triageIA(mensaje: string): Observable<any> {
    return this.http.post('http://localhost:8080/api/public/triage', { mensaje });
  }

  guardarFormularioManual(politicaId: string, taskId: string, schemaJson: string, estado: string, taskName?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrlForm}/politica/${politicaId}/tarea/${taskId}/guardar`, schemaJson, {
      params: { estado, taskName: taskName || '' }
    });
  }

  getFormularioStatus(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrlForm}/politica/${id}/status`);
  }

  predecirRespuestasIA(schemaJson: string, documentoTexto: string): Observable<any> {
    return this.http.post(`${this.usrUrl}/predict-responses`, { schemaJson, documentoTexto });
  }

  iniciarTramiteExterno(politicaId: string, respuestas: string, clienteCi: string): Observable<any> {
    return this.http.post(`http://localhost:8080/api/instancias/iniciar-externo`, { politicaId, respuestas, clienteCi });
  }

  iniciarTramitePresencial(politicaId: string, respuestas: string, clienteCi: string, userEmail?: string): Observable<any> {
    return this.http.post(`http://localhost:8080/api/instancias/iniciar-presencial`, { politicaId, respuestas, userEmail, clienteCi });
  }

  listarVersiones(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/versiones`);
  }

  restaurarVersion(id: string, versionId: string, autor: string): Observable<PoliticaNegocio> {
    return this.http.post<any>(`${this.apiUrl}/${id}/versiones/${versionId}/restaurar?autor=${encodeURIComponent(autor)}`, {});
  }

  registrarAuditoria(accion: string, modulo: string, entidadId: string, detalles: string): Observable<any> {
    const user = (this.authService as any).userSubject?.value;
    const payload = {
      accion,
      modulo,
      entidadId,
      detalles,
      usuarioId: user ? user.email : 'SISTEMA',
      usuarioNombre: user ? `${user.nombre} ${user.apellido}` : 'SISTEMA'
    };
    return this.http.post('http://localhost:8080/api/auditoria/registrar', payload);
  }

  generarDocumentoFinal(instanciaId: string, tareaId: string, html: string, userEmail: string): Observable<any> {
    return this.http.post(`http://localhost:8080/api/instancias/${instanciaId}/generar-documento-final`, {
      html,
      tareaId,
      userEmail
    });
  }

  getInstanciaDetalle(instanciaId: string): Observable<any> {
    return this.http.get<any>(`http://localhost:8080/api/instancias/${instanciaId}`);
  }
}
