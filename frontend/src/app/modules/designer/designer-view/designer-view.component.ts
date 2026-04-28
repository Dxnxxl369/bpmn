import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
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

interface Field { id: string; label: string; type: string; required: boolean; options?: string[]; pattern?: string; errorMessage?: string; }

@Component({
  selector: 'app-designer-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatTabsModule, MatProgressBarModule, MatTooltipModule, MatSnackBarModule, MatDialogModule, MatSelectModule, MatDividerModule, BpmnEditorComponent, AnaliticasDashboardComponent, FormularioDinamicoComponent, DragDropModule],
  templateUrl: './designer-view.component.html',
  styleUrls: ['./designer-view.component.css']
})
export class DesignerViewComponent implements OnInit {
  @ViewChild('bpmnEditor') bpmnEditor!: BpmnEditorComponent;

  textoManual: string = ''; miNombre: string = ''; miAvatar: string = ''; miEmail: string = '';
  procesando: boolean = false; generandoTodo: boolean = false; porcentajeCarga: number = 0; mensajeEstado: string = '';
  borradores: PoliticaNegocio[] = []; publicadas: PoliticaNegocio[] = []; previewPoliticas: PoliticaNegocio[] = [];
  politicaSeleccionada?: PoliticaNegocio;
  tareasLab: any[] = []; tareaSeleccionada: any = null; campoResaltadoId: string | null = null;
  camposActuales: Field[] = []; jsonSchemaString: string = '[]'; listoParaPublicar: boolean = false;
  colaboradores: any[] = []; cursoresRemotos: any[] = [];
  activeTabIndex: number = 0; repoTabIndex: number = 0;

  tareaPrevisualizada: any = null;
  schemaPrevia: string = '[]';

  isListeningManual = false;
  private recognition: any;

  constructor(private bpmsService: BpmsService, private snackBar: MatSnackBar, private dialog: MatDialog, private cdr: ChangeDetectorRef, private aiService: AiAssistantService, private collabService: CollaborationService, private authService: AuthService) {
    this.initVoiceRecognition();
  }

  initVoiceRecognition() {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'es-ES';

      this.recognition.onstart = () => {
        console.log("🎤 Reconocimiento de voz iniciado...");
        this.isListeningManual = true;
        this.cdr.detectChanges();
      };

      this.recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        console.log("📝 Texto captado:", transcript);
        this.textoManual = transcript;
        this.cdr.detectChanges();
      };

      this.recognition.onend = () => {
        console.log("🎤 Reconocimiento de voz finalizado.");
        this.isListeningManual = false;
        this.cdr.detectChanges();
      };

      this.recognition.onerror = (event: any) => {
        console.error("❌ Error en reconocimiento de voz:", event.error);
        this.isListeningManual = false;
        if (event.error === 'not-allowed') {
          alert("⚠️ Permiso denegado. Por favor, habilita el micrófono en la barra de direcciones del navegador.");
        } else if (event.error === 'network') {
          alert("⚠️ Error de red. El reconocimiento de voz de Google requiere conexión a internet.");
        }
        this.cdr.detectChanges();
      };
    } else {
      console.warn("⚠️ Este navegador no soporta la API de reconocimiento de voz.");
    }
  }

  toggleListeningManual() {
    if (!this.recognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Te recomendamos usar Chrome.");
      return;
    }

    try {
      if (this.isListeningManual) {
        this.recognition.stop();
      } else {
        this.recognition.start();
      }
    } catch (e) {
      console.error("Error al controlar el microfono:", e);
      this.recognition.stop();
    }
    this.cdr.detectChanges();
  }

  ngOnInit() { 
    this.authService.user$.subscribe(user => { if (user) { this.miNombre = `${user.nombre} ${user.apellido}`; this.miAvatar = user.avatar; this.miEmail = user.email; this.cdr.detectChanges(); } });
    this.cargarPoliticas(); 
    this.aiService.resetContext();
    this.collabService.globalPresence$.subscribe(users => { 
      if (this.miEmail && this.politicaSeleccionada?.id) {
        const uniqueUsers = new Map<string, any>();
        const sorted = [...users].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        for (const u of sorted) {
          const myPolicy = String(this.politicaSeleccionada.id);
          const userPolicy = String(u.politicaId || 'null');
          
          if (u.userId !== this.miEmail && userPolicy === myPolicy && !uniqueUsers.has(u.userId)) {
            uniqueUsers.set(u.userId, u);
          }
        }
        this.colaboradores = Array.from(uniqueUsers.values());
        this.cdr.detectChanges();
      } else {
        this.colaboradores = [];
        this.cdr.detectChanges();
      }
    });
    this.collabService.cursors$.subscribe(cursors => { this.cursoresRemotos = cursors; this.cdr.detectChanges(); });
    this.collabService.schemaSync$.subscribe(msg => { 
      if (msg && this.tareaSeleccionada) {
        try {
          const data = typeof msg === 'string' ? JSON.parse(msg) : msg;
          // SOLO ACTUALIZAR SI ES LA TAREA QUE TENGO ABIERTA
          if (data.taskId === this.tareaSeleccionada.id) {
            this.camposActuales = JSON.parse(data.schema);
            this.jsonSchemaString = data.schema;
            this.cdr.detectChanges();
          }
        } catch (e) {
          console.error("Error en sincronización colaborativa:", e);
        }
      } 
    });
    this.aiService.formUpdate$.subscribe(newSchema => {
      if (newSchema && this.tareaSeleccionada) { this.camposActuales = JSON.parse(newSchema); this.sincronizarJSON(); }
    });
  }

  onTabChange(event: any) { 
    this.activeTabIndex = event.index; 
    if (event.index === 1 && this.politicaSeleccionada) {
       this.tareasLab = [];
       this.cargarTareasLab(); 
    }
    this.cdr.detectChanges(); 
  }

  seleccionarPolitica(p: PoliticaNegocio) { 
    this.tareaSeleccionada = null;
    this.tareaPrevisualizada = null;
    this.tareasLab = [];
    this.camposActuales = [];
    this.jsonSchemaString = '[]';
    this.cdr.detectChanges();

    this.politicaSeleccionada = p; 
    this.actualizarStatusLab();
    this.aiService.setContext({ id: p.id, name: p.nombre, manual: p.descripcion, mode: 'diseno' });
    if (p.id) this.collabService.conectar(p.id);
  }

  cerrarEditor() { 
    if (this.politicaSeleccionada?.id) this.collabService.desconectar(this.politicaSeleccionada.id); 
    this.politicaSeleccionada = undefined; 
    this.tareaSeleccionada = null; 
    this.tareaPrevisualizada = null; 
    this.tareasLab = [];
    this.camposActuales = [];
    this.jsonSchemaString = '[]';
    this.cargarPoliticas(); 
    this.aiService.resetContext(); 
    this.cdr.detectChanges();
  }

  cargarPoliticas() { 
    this.bpmsService.listarPoliticas().subscribe({ 
      next: data => { this.borradores = data.filter(p => p.estado === 'BORRADOR'); this.publicadas = data.filter(p => p.estado === 'ACTIVA'); this.cdr.detectChanges(); }, 
      error: err => { console.error('Error al cargar politicas:', err); this.snackBar.open('Error al conectar con el servidor', 'Cerrar', { duration: 5000 }); } 
    }); 
  }

  confirmarGuardado(proposal: PoliticaNegocio, index: number) {
    this.bpmsService.crearPolitica(proposal).subscribe({ 
      next: (res) => {
        this.snackBar.open(`✅ '${res.nombre}' guardado en borradores.`, 'OK', { duration: 3000, panelClass: ['snack-success-premium'], horizontalPosition: 'center', verticalPosition: 'bottom' });
        this.previewPoliticas.splice(index, 1);
        this.cargarPoliticas();
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('❌ Error al guardar la propuesta', 'Cerrar', { horizontalPosition: 'center', verticalPosition: 'bottom' })
    });
  }

  mandarABorrador(p: PoliticaNegocio) {
    if (!p.id) return;
    const politicaActualizada = { ...p, estado: 'BORRADOR' };
    this.bpmsService.actualizarPolitica(p.id, politicaActualizada).subscribe({
      next: () => {
        this.snackBar.open(`✅ '${p.nombre}' ha vuelto a borradores.`, 'OK', { duration: 4000, panelClass: ['snack-success-premium'], horizontalPosition: 'center', verticalPosition: 'bottom' });
        this.cargarPoliticas();
      },
      error: () => {
        this.bpmsService.archivarPolitica(p.id!).subscribe({
          next: () => { this.cargarPoliticas(); },
          error: () => this.snackBar.open('❌ Error al cambiar estado', 'Cerrar', { panelClass: ['snack-error-premium'], horizontalPosition: 'center', verticalPosition: 'bottom' })
        });
      }
    });
  }

  onFileSelected(event: any) { 
    const file = event.target.files[0]; 
    if (file) { 
      this.procesando = true; this.porcentajeCarga = 0; this.mensajeEstado = 'Analizando PDF...'; 
      const int = setInterval(() => { if(this.porcentajeCarga < 90) this.porcentajeCarga += 5; this.cdr.detectChanges(); }, 500); 
      this.bpmsService.procesarDocumento(file).subscribe({ 
        next: (res) => { 
          clearInterval(int); this.porcentajeCarga = 100; 
          setTimeout(() => { this.previewPoliticas = res; this.procesando = false; this.cdr.detectChanges(); }, 500); 
        }, 
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

  generarTodosFormularios() { if (!this.politicaSeleccionada?.id) return; this.generandoTodo = true; const promises = this.tareasLab.map(t => this.bpmsService.generarFormularioIA(this.politicaSeleccionada!.id!, t.id, t.nombre).toPromise()); Promise.all(promises).then(() => { this.generandoTodo = false; this.cargarTareasLab(); this.actualizarStatusLab(); this.cdr.detectChanges(); }).catch(() => { this.generandoTodo = false; this.cdr.detectChanges(); }); }
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

    if (t.tieneFormulario || t.estadoFormulario !== 'VACIO') {
      this.bpmsService.generarFormulario(this.politicaSeleccionada!.id!, t.id).subscribe(schema => {
        let fields = JSON.parse(schema);

        // CORRECCIÓN: Si es un punto de decisión, inyectar/corregir las opciones del motor de decisión
        if (t.esPuntoDecision && t.ramas) {
          const decisionField = fields.find((f: any) => f.id === 'decision_motor');
          if (decisionField) {
            // Mapeamos las ramas para extraer solo el texto de la condición
            decisionField.options = t.ramas.map((r: any) => r.condicion);
            console.log("Ramas mapeadas para decision_motor:", decisionField.options);
          }
        }

        this.camposActuales = fields;
        this.jsonSchemaString = JSON.stringify(fields);
        this.cdr.detectChanges();
      });
    } else {
      this.camposActuales = []; 

      // Si está vacío pero es punto de decisión, podemos crear el campo automáticamente
      if (t.esPuntoDecision && t.ramas) {
        this.camposActuales = [{
          id: 'decision_motor',
          label: 'DECISIÓN DEL PROCESO',
          type: 'select',
          required: true,
          options: t.ramas.map((r: any) => r.condicion)
        }];
      }

      this.jsonSchemaString = JSON.stringify(this.camposActuales);
      this.cdr.detectChanges();
    }
  }
  agregarOpcion(field: Field) { if (!field.options) field.options = []; field.options.push(`Nueva Opcion ${field.options.length + 1}`); this.sincronizarJSON(); }
  eliminarOpcion(field: Field, idx: number) { if (field.options) { field.options.splice(idx, 1); this.sincronizarJSON(); } }
  onDrop(event: CdkDragDrop<Field[]>) { moveItemInArray(this.camposActuales, event.previousIndex, event.currentIndex); this.sincronizarJSON(); }
  agregarCampo(type: string) { const newField: Field = { id: `campo_${Date.now()}`, label: type === 'button' ? 'NUEVO BOTON' : 'Campo ' + (this.camposActuales.length + 1), type: type, required: type !== 'button' }; if (type === 'select') newField.options = ['Opcion 1', 'Opcion 2']; this.camposActuales.push(newField); this.sincronizarJSON(); }
  eliminarCampo(idx: number) { this.camposActuales.splice(idx, 1); this.sincronizarJSON(); }
  sincronizarJSON() {
    // Sanitizamos antes de guardar para asegurar que el motor de orquestación reciba strings planos
    const sanitizedFields = this.camposActuales.map(f => {
      if (f.options && Array.isArray(f.options)) {
        return {
          ...f,
          options: f.options.map(opt => (typeof opt === 'object' && opt !== null) ? (opt as any).condicion : String(opt))
        };
      }
      return f;
    });

    this.jsonSchemaString = JSON.stringify(sanitizedFields);
    this.cdr.detectChanges();
    if (this.politicaSeleccionada?.id && this.tareaSeleccionada?.id) {
      this.collabService.enviarEsquema(this.politicaSeleccionada.id, this.tareaSeleccionada.id, this.jsonSchemaString);
    }
  }
  
  guardarProgreso(estado: string) { 
    if (!this.tareaSeleccionada) return; 
    this.bpmsService.guardarFormularioManual(this.politicaSeleccionada!.id!, this.tareaSeleccionada.id, this.jsonSchemaString, estado, this.tareaSeleccionada.nombre).subscribe({ 
      next: () => { 
        this.tareaSeleccionada.estadoFormulario = estado;
        const index = this.tareasLab.findIndex(t => t.id === this.tareaSeleccionada.id);
        if (index !== -1) this.tareasLab[index].estadoFormulario = estado;
        this.actualizarStatusLab(); this.cargarTareasLab(); 
        const msg = estado === 'LISTO' ? '✅ Formulario validado con éxito' : '📝 Guardado como borrador';
        this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: estado === 'LISTO' ? ['snack-success-premium'] : ['snack-info-premium'], horizontalPosition: 'center', verticalPosition: 'bottom' }); 
        
        if (estado === 'LISTO') {
          this.volverAlListado();
        }
      } 
    }); 
  }

  volverAlListado() {
    this.tareaSeleccionada = null;
    this.tareaPrevisualizada = null;
    this.camposActuales = [];
    this.jsonSchemaString = '[]';
    // Restaurar contexto de la política general
    if (this.politicaSeleccionada) {
      this.aiService.setContext({ 
        id: this.politicaSeleccionada.id, 
        name: this.politicaSeleccionada.nombre, 
        manual: this.politicaSeleccionada.descripcion, 
        mode: 'diseno' 
      });
    }
    this.cdr.detectChanges();
  }

  generarFormularioIndividual(t: any) {
    const instruccion = prompt(`IA: ¿Qué deseas cambiar en '${t.nombre}'?`, "");
    if (instruccion) {
      this.bpmsService.generarFormularioIA(this.politicaSeleccionada!.id!, t.id, `${t.nombre}. INSTRUCCION: ${instruccion}`).subscribe({ next: (res) => {
        this.camposActuales = JSON.parse(res.schemaJson); this.jsonSchemaString = res.schemaJson; this.cdr.detectChanges();
        if (this.politicaSeleccionada?.id && t.id) this.collabService.enviarEsquema(this.politicaSeleccionada.id, t.id, this.jsonSchemaString);
      }});
    }
  }
  
  intentarPublicar() {
    if (!this.listoParaPublicar) {
      this.snackBar.open('BLOQUEADO: No puedes publicar mientras no estén listos todos los formularios', 'REVISAR', { 
        duration: 5000, panelClass: ['snack-error-premium'], horizontalPosition: 'center', verticalPosition: 'bottom'
      });
      return;
    }
    this.publicarProceso();
  }

  publicarProceso() { 
    this.bpmsService.activarPolitica(this.politicaSeleccionada!.id!).subscribe({ 
      next: (res) => { 
        this.dialog.open(PublishResultDialogComponent, { width: '500px', data: { report: res.report } }); 
        this.cerrarEditor(); 
      } 
    }); 
  }

  trackByIndex(index: number, obj: any): any { return index; }

  esCampoProtegido(fieldId: string): boolean {
    return fieldId === 'decision_motor' && (this.tareaSeleccionada?.esPuntoDecision || false);
  }

  async guardarBPMN() { 
    try { 
      const modeler = this.bpmnEditor['modeler']; 
      if(!modeler) return; 
      const { xml } = await modeler.saveXML({ format: true }); 
      this.bpmsService.guardarDiagrama(this.politicaSeleccionada!.id!, xml).subscribe(() => { 
        this.snackBar.open('Diagrama guardado exitosamente', 'OK', { 
          duration: 2000, 
          panelClass: ['snack-success-premium'], 
          horizontalPosition: 'center', 
          verticalPosition: 'bottom' 
        }); 
      }); 
    } catch (e) { 
      console.error(e); 
    } 
  }
}
