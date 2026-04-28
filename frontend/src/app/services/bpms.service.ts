import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PoliticaNegocio {
  id?: string;
  nombre: string;
  descripcion: string;
  xmlBpmn: string;
  estado: string;
  ultimaModificacion: string;
}

export interface UsuarioEjecutivo {
  id: string;
  nombre: string;
  email: string;
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
  private apiUrl = 'http://13.217.197.171:8080/api/politicas';
  private usrUrl = 'http://13.217.197.171:8080/api/usuarios';
  private deptUrl = 'http://13.217.197.171:8080/api/departamentos';
  private apiUrlForm = 'http://13.217.197.171:8080/api/formulario';

  constructor(private http: HttpClient) {}

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
    return this.http.get<any[]>(`http://13.217.197.171:8080/api/instancias/tareas/pendientes`, {
      params: { laneId }
    });
  }

  getTareasEnProceso(laneId: string | string[]): Observable<any[]> {
    return this.http.get<any[]>(`http://13.217.197.171:8080/api/instancias/tareas/en-proceso`, {
      params: { laneId }
    });
  }

  getTareasCompletadas(laneId: string | string[]): Observable<any[]> {
    return this.http.get<any[]>(`http://13.217.197.171:8080/api/instancias/tareas/completadas`, {
      params: { laneId }
    });
  }

  completarTarea(tareaId: string, respuestas: any): Observable<any> {
    return this.http.post(`http://13.217.197.171:8080/api/instancias/tareas/${tareaId}/completar`, respuestas);
  }

  atenderTarea(tareaId: string, userEmail: string): Observable<any> {
    return this.http.post(`http://13.217.197.171:8080/api/instancias/tareas/${tareaId}/atender`, null, {
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

  iniciarTramitePresencial(politicaId: string, respuestas: string, userEmail?: string): Observable<any> {
    return this.http.post(`http://13.217.197.171:8080/api/instancias/iniciar-presencial`, { politicaId, respuestas, userEmail });
  }

  listarVersiones(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/versiones`);
  }

  restaurarVersion(id: string, versionId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/versiones/${versionId}/restaurar`, {});
  }

  getInstanciaDetalle(instanciaId: string): Observable<any> {
    return this.http.get<any>(`http://13.217.197.171:8080/api/instancias/${instanciaId}`);
  }
}
