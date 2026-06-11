import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { BpmsService, PoliticaNegocio } from '../../../services/bpms.service';
import { BpmnEditorComponent } from '../../../components/bpmn-editor/bpmn-editor.component';
import { AnaliticasDashboardComponent } from '../../../components/analiticas-dashboard/analiticas-dashboard.component';
import { PublishResultDialogComponent } from '../../../components/publish-result-dialog/publish-result-dialog.component';
import { FormularioDinamicoComponent } from '../../../components/formulario-dinamico/formulario-dinamico.component';
import { AiAssistantService } from '../../../services/ai-assistant.service';
import { CollaborationService } from '../../../services/collaboration.service';
import { AuthService } from '../../../services/auth.service';
import { Subscription, filter } from 'rxjs';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Router, NavigationEnd } from '@angular/router';

interface Field { id: string; label: string; type: string; required: boolean; options?: string[]; pattern?: string; errorMessage?: string; }

@Component({
  selector: 'app-designer-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatTabsModule, MatProgressBarModule, MatTooltipModule, MatSnackBarModule, MatDialogModule, MatSelectModule, MatDividerModule, BpmnEditorComponent, FormularioDinamicoComponent, DragDropModule],
  templateUrl: './designer-view.component.html',
  styleUrls: ['./designer-view.component.css']
})
export class DesignerViewComponent implements OnInit, OnDestroy {
  @ViewChild('bpmnEditor') bpmnEditor!: BpmnEditorComponent;

  textoManual: string = ''; miNombre: string = ''; miAvatar: string = ''; miEmail: string = '';
  procesando: boolean = false; generandoTodo: boolean = false; porcentajeCarga: number = 0; mensajeEstado: string = '';
  borradores: PoliticaNegocio[] = []; publicadas: PoliticaNegocio[] = []; previewPoliticas: PoliticaNegocio[] = [];
  politicaSeleccionada?: PoliticaNegocio;
  tareasLab: any[] = []; tareaSeleccionada: any = null; campoResaltadoId: string | null = null;
  camposActuales: Field[] = []; jsonSchemaString: string = '[]'; listoParaPublicar: boolean = false;
  versiones: any[] = [];
  mostrarVersiones = false;
  modoCapsula = false; 
  versionEnCapsula: any = null;
  presentXml: string = ''; 
  colaboradores: any[] = []; 
  activeTabIndex: number = 0; repoTabIndex: number = 0;
  syncStatus: string = 'CONECTADO';

  tareaPrevisualizada: any = null;
  schemaPrevia: string = '[]';

  isListeningManual = false;
  private recognition: any;
  private subs = new Subscription();

  constructor(private bpmsService: BpmsService, private snackBar: MatSnackBar, private dialog: MatDialog, private cdr: ChangeDetectorRef, private aiService: AiAssistantService, private collabService: CollaborationService, private authService: AuthService, private router: Router) {
    this.initVoiceRecognition();
  }

  initVoiceRecognition() {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'es-ES';
      this.recognition.onstart = () => { this.isListeningManual = true; this.cdr.detectChanges(); };
      this.recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
        this.textoManual = transcript; this.cdr.detectChanges();
      };
      this.recognition.onend = () => { this.isListeningManual = false; this.cdr.detectChanges(); };
      this.recognition.onerror = (event: any) => { this.isListeningManual = false; this.cdr.detectChanges(); };
    }
  }

  toggleListeningManual() {
    if (!this.recognition) return;
    try {
      if (this.isListeningManual) this.recognition.stop();
      else this.recognition.start();
    } catch (e) { this.recognition.stop(); }
    this.cdr.detectChanges();
  }

  ngOnInit() { 
    this.bpmsService.registrarAuditoria('ACCESO_MODULO', 'DISEÑADOR IA', 'MAIN', 'Entró al módulo de diseño').subscribe();
    this.subs.add(this.authService.user$.subscribe(user => { if (user) { this.miNombre = `${user.nombre} ${user.apellido}`; this.miAvatar = user.avatar; this.miEmail = user.email; this.cdr.detectChanges(); } }));
    this.cargarPoliticas(); 
    this.aiService.resetContext();

    // LISTA DE COLABORADORES EN VIVO (FILTRADA POR POLÍTICA)
    this.subs.add(this.collabService.globalPresence$.subscribe(users => { 
      if (this.miEmail && this.politicaSeleccionada?.id) {
        this.colaboradores = users.filter(u => 
            u.userId !== this.miEmail && 
            String(u.politicaId) === String(this.politicaSeleccionada?.id) &&
            u.action !== 'leave' &&
            u.activity !== 'history' // OCULTAR CURSORES DE QUIENES ESTÁN EN HISTORIAL
        );
        this.cdr.detectChanges();
      } else {
        this.colaboradores = [];
        this.cdr.detectChanges();
      }
    }));

    // SINCRONIZACIÓN DE DIAGRAMA (Nivel Diseñador)
    this.subs.add(this.collabService.diagramSync$.subscribe(msg => {
      if (msg && this.politicaSeleccionada && String(msg.politicaId) === String(this.politicaSeleccionada.id)) {
        if (msg.sessionId !== this.collabService.sessionId) {
          console.log(`🚀 [LINK SYNC] Actualización estructural de ${msg.userName}`);
          this.syncStatus = 'ACTUALIZADO';
          
          // FORZAR TRIGGER DE @INPUT creando nueva referencia
          this.politicaSeleccionada = { ...this.politicaSeleccionada, xmlBpmn: msg.xml };
          
          this.cargarVersiones(); 
          this.cdr.detectChanges();
          setTimeout(() => { this.syncStatus = 'CONECTADO'; this.cdr.detectChanges(); }, 2000);
        }
      }
    }));

    this.subs.add(this.collabService.schemaSync$.subscribe((msg: any) => { 
      if (msg && this.tareaSeleccionada && msg.taskId === this.tareaSeleccionada.id) {
         if (msg.sessionId !== this.collabService.sessionId) {
            this.camposActuales = JSON.parse(msg.schema);
            this.jsonSchemaString = msg.schema;
            this.cdr.detectChanges();
         }
      } 
    }));
    
    this.subs.add(this.aiService.formUpdate$.subscribe(newSchema => {
      if (newSchema && this.tareaSeleccionada) { this.camposActuales = JSON.parse(newSchema); this.sincronizarJSON(); }
    }));
  }

  onTabChange(event: any) { 
    this.activeTabIndex = event.index; 
    
    if (this.activeTabIndex === 1) {
        // PESTAÑA DE FORMULARIOS (LAB)
        this.cargarTareasLab(); 
        this.actualizarStatusLab();
        if (this.politicaSeleccionada?.id) {
            this.bpmsService.registrarAuditoria('VISTA_FORMULARIOS', 'DISEÑADOR IA', this.politicaSeleccionada.id, `Viendo lista de tareas: ${this.politicaSeleccionada.nombre}`).subscribe();
        }
    }

    if (this.activeTabIndex === 0 && this.bpmnEditor) {
      setTimeout(() => {
        if (this.bpmnEditor.diagram) {
           this.bpmnEditor.diagram.requestUpdate();
           this.bpmnEditor.diagram.zoomToFit();
        }
      }, 200);
    }
    if (event.index === 1 && this.politicaSeleccionada) {
       this.tareasLab = [];
       this.cargarTareasLab(); 
    }
    this.cdr.detectChanges(); 
  }

  seleccionarPolitica(p: PoliticaNegocio) { 
    this.tareaSeleccionada = null; this.tareaPrevisualizada = null; this.tareasLab = []; this.camposActuales = []; this.jsonSchemaString = '[]';
    this.politicaSeleccionada = p; 
    this.bpmsService.registrarAuditoria('ABRIR_POLITICA', 'DISEÑADOR IA', p.id || 'N/A', `Abrió proceso: ${p.nombre}`).subscribe();
    this.actualizarStatusLab();
    this.aiService.setContext({ id: p.id, name: p.nombre, manual: p.descripcion, mode: 'diseno' });
    if (p.id) {
      this.collabService.conectar(p.id);
      this.cargarVersiones();
      this.collabService.enviarActividadGlobal(`Editando: ${p.nombre}`, 'architecture', 'active', p.id);
    }
    this.cdr.detectChanges();
  }

  cargarVersiones() {
    if (!this.politicaSeleccionada?.id) return;
    this.bpmsService.listarVersiones(this.politicaSeleccionada.id).subscribe(v => {
      this.versiones = v;
      this.cdr.detectChanges();
    });
  }

  restaurarVersion(v: any) {
    if (!this.politicaSeleccionada?.id) return;
    this.bpmsService.restaurarVersion(this.politicaSeleccionada.id, v.id, this.miNombre).subscribe(p => {
      this.modoCapsula = false;
      this.politicaSeleccionada = p;
      this.snackBar.open(`✅ Versión ${v.version} restaurada para todos`, 'OK', { duration: 3000 });
      this.collabService.enviarDiagrama(p.id!, p.xmlBpmn); 
      this.cargarVersiones();
      this.cdr.detectChanges();
    });
  }

  verVersionPasada(v: any) {
    if (!this.politicaSeleccionada) return;
    
    // Si es la primera vez que entramos a la cápsula, guardamos el presente
    if (!this.modoCapsula) {
      this.presentXml = this.politicaSeleccionada.xmlBpmn || '';
      this.modoCapsula = true;
    }
    
    // Guardar referencia de la versión actual en cápsula
    (this as any).versionEnCapsula = v;

    this.politicaSeleccionada = { ...this.politicaSeleccionada, xmlBpmn: v.xmlContent };
    
    // NO ENVIAR EL ESTADO DE CÁPSULA POR WS PARA NO PERJUDICAR A OTROS
    this.collabService.enviarActividadGlobal(`Viendo historial (v${v.version}): ${this.politicaSeleccionada.nombre}`, 'history', 'active', this.politicaSeleccionada.id);
    this.cdr.detectChanges();
  }

  restaurarVersionDesdeCapsula() {
    const v = (this as any).versionEnCapsula;
    if (v) this.restaurarVersion(v);
  }

  volverAlPresente() {
    this.modoCapsula = false;
    (this as any).versionEnCapsula = null; // Limpiar selección
    if (this.politicaSeleccionada) {
        this.politicaSeleccionada = { ...this.politicaSeleccionada, xmlBpmn: this.presentXml };
        // VOLVER AL ESTADO NORMAL EN WS
        this.collabService.enviarActividadGlobal(`Editando: ${this.politicaSeleccionada.nombre}`, 'architecture', 'active', this.politicaSeleccionada.id);
    }
    this.cdr.detectChanges();
  }

  cerrarEditor() { 
    if (this.politicaSeleccionada?.id) this.collabService.desconectar(this.politicaSeleccionada.id); 
    this.politicaSeleccionada = undefined; 
    this.collabService.enviarActividadGlobal('En el Menú', 'sensors', 'active', null);
    this.cargarPoliticas(); this.aiService.resetContext(); this.cdr.detectChanges();
  }

  cargarPoliticas() { 
    this.bpmsService.listarPoliticas().subscribe({ 
      next: data => { this.borradores = data.filter(p => p.estado === 'BORRADOR'); this.publicadas = data.filter(p => p.estado === 'ACTIVA'); this.cdr.detectChanges(); }, 
      error: err => { this.snackBar.open('Error al cargar politicas', 'Cerrar', { duration: 5000 }); } 
    }); 
  }

  confirmarGuardado(proposal: PoliticaNegocio, index: number) {
    this.bpmsService.crearPolitica(proposal).subscribe({ 
      next: (res) => {
        this.snackBar.open(`✅ '${res.nombre}' guardado.`, 'OK', { duration: 3000 });
        this.previewPoliticas.splice(index, 1); this.cargarPoliticas(); this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('❌ Error al guardar', 'Cerrar')
    });
  }

  mandarABorrador(p: PoliticaNegocio) {
    if (!p.id) return;
    this.bpmsService.actualizarPolitica(p.id, { ...p, estado: 'BORRADOR' }).subscribe({
      next: () => { this.snackBar.open(`✅ '${p.nombre}' vuelto a borradores.`, 'OK', { duration: 4000 }); this.cargarPoliticas(); },
      error: () => { this.bpmsService.archivarPolitica(p.id!).subscribe({ next: () => this.cargarPoliticas() }); }
    });
  }

  onFileSelected(event: any) { 
    const file = event.target.files[0]; 
    if (file) { 
      this.procesando = true; this.porcentajeCarga = 0; this.mensajeEstado = 'Analizando PDF...'; 
      const int = setInterval(() => { if(this.porcentajeCarga < 90) this.porcentajeCarga += 5; this.cdr.detectChanges(); }, 500); 
      this.bpmsService.procesarDocumento(file).subscribe({ 
        next: (res) => { clearInterval(int); this.porcentajeCarga = 100; setTimeout(() => { this.previewPoliticas = res; this.procesando = false; this.cdr.detectChanges(); }, 500); }, 
        error: () => { clearInterval(int); this.procesando = false; this.cdr.detectChanges(); } 
      }); 
    } 
  }

  procesarTexto() { 
    if (!this.textoManual) return; 
    this.procesando = true; this.porcentajeCarga = 0; this.mensajeEstado = 'Analizando manual...'; 
    this.bpmsService.procesarTextoManual(this.textoManual).subscribe({ 
      next: (res) => { this.previewPoliticas = res; this.procesando = false; this.textoManual = ''; this.cdr.detectChanges(); }, 
      error: () => { this.procesando = false; this.cdr.detectChanges(); } 
    }); 
  }

  async generarTodosFormularios() { 
    if (!this.politicaSeleccionada?.id) return; 
    this.generandoTodo = true; 
    this.mensajeEstado = 'Generando interfaces con IA...';
    
    for (const t of this.tareasLab) {
      try {
        await this.bpmsService.generarFormularioIA(this.politicaSeleccionada.id, t.id, t.nombre).toPromise();
        this.snackBar.open(`✅ Formulario generado para: ${t.nombre}`, 'OK', { duration: 1000 });
      } catch (e) {
        console.error(`Error generando ${t.nombre}`, e);
      }
    }

    this.generandoTodo = false; 
    this.cargarTareasLab(); 
    this.actualizarStatusLab(); 
    this.cdr.detectChanges();
    this.snackBar.open('Fin de la generación masiva', 'Entendido');
  }
  actualizarStatusLab() { if (!this.politicaSeleccionada?.id) return; this.bpmsService.getFormularioStatus(this.politicaSeleccionada.id).subscribe(status => { this.listoParaPublicar = status.listoParaPublicar; this.cdr.detectChanges(); }); }
  cargarTareasLab() { if (!this.politicaSeleccionada?.id) return; this.bpmsService.listarTareasPolitica(this.politicaSeleccionada.id).subscribe(tareas => { this.tareasLab = tareas; this.cdr.detectChanges(); }); }
  
  previsualizarTarea(t: any) {
    this.tareaPrevisualizada = t;
    if (t.tieneFormulario || t.estadoFormulario !== 'VACIO') { this.bpmsService.generarFormulario(this.politicaSeleccionada!.id!, t.id).subscribe(schema => { this.schemaPrevia = schema; this.cdr.detectChanges(); }); } 
    else { this.schemaPrevia = '[]'; this.cdr.detectChanges(); }
  }

  seleccionarTareaLab(t: any) {
    this.tareaSeleccionada = t;
    this.aiService.setContext({ id: this.politicaSeleccionada?.id, name: `${this.politicaSeleccionada?.nombre} > ${t.nombre}`, manual: this.politicaSeleccionada?.descripcion, mode: 'diseno' });
    
    if (this.politicaSeleccionada?.id) {
        this.bpmsService.registrarAuditoria('EDITAR_FORMULARIO', 'FORMULARIOS', this.politicaSeleccionada.id, `Entró a editar: ${t.nombre}`).subscribe();
    }

    if (t.tieneFormulario || t.estadoFormulario !== 'VACIO') {
      this.bpmsService.generarFormulario(this.politicaSeleccionada!.id!, t.id).subscribe(schema => {
        let fields = JSON.parse(schema);
        this.camposActuales = fields; this.jsonSchemaString = JSON.stringify(fields); this.cdr.detectChanges();
      });
    } else {
      this.camposActuales = []; this.jsonSchemaString = '[]'; this.cdr.detectChanges();
    }
  }

  agregarOpcion(field: Field) { if (!field.options) field.options = []; field.options.push(`Nueva Opcion ${field.options.length + 1}`); this.sincronizarJSON(); }
  eliminarOpcion(field: Field, idx: number) { if (field.options) { field.options.splice(idx, 1); this.sincronizarJSON(); } }
  onDrop(event: CdkDragDrop<Field[]>) { moveItemInArray(this.camposActuales, event.previousIndex, event.currentIndex); this.sincronizarJSON(); }
  agregarCampo(type: string) { const newField: Field = { id: `campo_${Date.now()}`, label: 'Campo ' + (this.camposActuales.length + 1), type: type, required: true }; if (type === 'select') newField.options = ['Opcion 1']; this.camposActuales.push(newField); this.sincronizarJSON(); }
  eliminarCampo(idx: number) { 
    const field = this.camposActuales[idx];
    if (this.esCampoProtegido(field.id)) {
      this.snackBar.open('❌ Este campo es vital para el flujo y no puede eliminarse', 'Entendido', { duration: 3000 });
      return;
    }
    this.camposActuales.splice(idx, 1); 
    this.sincronizarJSON(); 
  }

  sincronizarJSON() {
    this.jsonSchemaString = JSON.stringify(this.camposActuales); this.cdr.detectChanges();
    if (this.politicaSeleccionada?.id && this.tareaSeleccionada?.id) this.collabService.enviarEsquema(this.politicaSeleccionada.id, this.tareaSeleccionada.id, this.jsonSchemaString);
  }

  private normalizeFieldIds() {
    const usedIds = new Set<string>();
    this.camposActuales.forEach(field => {
      // No normalizamos campos protegidos como 'decision_motor'
      if (this.esCampoProtegido(field.id)) {
        usedIds.add(field.id);
        return;
      }

      // Generar slug desde el label
      let semanticId = field.label
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')           // Espacios a guiones bajos
        .replace(/[^\w]/g, '')         // Quitar caracteres no alfanuméricos
        .replace(/_+/g, '_');          // Quitar guiones bajos duplicados

      if (!semanticId) semanticId = 'campo';

      // Evitar colisiones (si hay dos campos con el mismo label)
      let finalId = semanticId;
      let counter = 1;
      while (usedIds.has(finalId)) {
        finalId = `${semanticId}_${counter}`;
        counter++;
      }

      field.id = finalId;
      usedIds.add(finalId);
    });
    
    // Actualizar el string JSON para que el backend reciba los nuevos IDs
    this.jsonSchemaString = JSON.stringify(this.camposActuales);
  }
  
  guardarProgreso(estado: string) { 
    if (!this.tareaSeleccionada) return; 

    // NORMALIZACIÓN SEMÁNTICA: Antes de guardar, convertimos IDs aleatorios a nombres legibles
    this.normalizeFieldIds();

    this.bpmsService.guardarFormularioManual(this.politicaSeleccionada!.id!, this.tareaSeleccionada.id, this.jsonSchemaString, estado, this.tareaSeleccionada.nombre).subscribe({ 
      next: () => { 
        const accion = estado === 'BORRADOR' ? 'REVERTIR_A_BORRADOR_FORM' : 'GUARDAR_FORMULARIO';
        this.bpmsService.registrarAuditoria(accion, 'FORMULARIOS', this.politicaSeleccionada!.id!, `Tarea: ${this.tareaSeleccionada!.nombre} -> ${estado} (IDs Normalizados)`).subscribe();
        this.tareaSeleccionada.estadoFormulario = estado; this.actualizarStatusLab(); this.cargarTareasLab(); 
        this.snackBar.open('Guardado con éxito (IDs Normalizados)', 'OK', { duration: 3000 }); 
        if (estado === 'LISTO') this.volverAlListado();
      } 
    }); 
  }

  volverAlListado() {
    this.tareaSeleccionada = null; this.tareaPrevisualizada = null; this.camposActuales = []; this.jsonSchemaString = '[]';
    this.cdr.detectChanges();
  }

  generarFormularioIndividual(t: any) {
    this.bpmsService.generarFormularioIA(this.politicaSeleccionada!.id!, t.id, t.nombre).subscribe({ next: (res) => {
      this.camposActuales = JSON.parse(res.schemaJson); this.jsonSchemaString = res.schemaJson; this.cdr.detectChanges();
      if (this.politicaSeleccionada?.id && t.id) this.collabService.enviarEsquema(this.politicaSeleccionada.id, t.id, this.jsonSchemaString);
    }});
  }

  onFieldHover(fieldId: string | null) {
    this.campoResaltadoId = fieldId;
    this.cdr.detectChanges();
  }
  
  publicarProceso() { 
    if (!this.listoParaPublicar) return;
    this.bpmsService.activarPolitica(this.politicaSeleccionada!.id!).subscribe({ 
      next: (res) => { this.dialog.open(PublishResultDialogComponent, { width: '500px', data: { report: res.report } }); this.cerrarEditor(); } 
    }); 
  }

  trackByIndex(index: number, obj: any): any { return index; }

  async descargarXML() {
    if (!this.bpmnEditor) return;
    const xml = await this.bpmnEditor.saveXML();
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `proceso_uml.xml`; a.click();
    window.URL.revokeObjectURL(url);
  }

  esCampoProtegido(fieldId: string): boolean { return fieldId === 'decision_motor'; }

  guardarBPMN() { 
    if (!this.politicaSeleccionada?.id || !this.bpmnEditor) return; 
    this.bpmnEditor.saveXML().then(xml => {
      this.bpmsService.guardarDiagrama(this.politicaSeleccionada!.id!, xml).subscribe(() => { 
          this.snackBar.open('Diagrama guardado', 'OK', { duration: 2000 });
          this.collabService.enviarDiagrama(this.politicaSeleccionada!.id!, xml);
      }); 
    });
  }

  guardarCambiosDetalle() {
    if (!this.politicaSeleccionada) return;
    this.bpmsService.actualizarPolitica(this.politicaSeleccionada.id!, this.politicaSeleccionada).subscribe(() => {
      this.snackBar.open('Detalles del proceso actualizados', 'OK', { duration: 2000 });
    });
  }

  verPdfOrigen(docId: string) {
    window.open(`http://localhost:8080/api/documentos/${docId}/view`, '_blank');
  }

  ngOnDestroy() { this.subs.unsubscribe(); }
}

