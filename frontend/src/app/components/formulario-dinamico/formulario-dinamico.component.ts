import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { BpmsService } from '../../services/bpms.service';
import { DocumentEditorComponent } from '../document-editor/document-editor.component';

@Component({
  selector: 'app-formulario-dinamico',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, 
    MatProgressSpinnerModule, MatProgressBarModule, MatSnackBarModule, 
    HttpClientModule, SafeUrlPipe, DocumentEditorComponent
  ],
  templateUrl: './formulario-dinamico.component.html',
  styleUrls: ['./formulario-dinamico.component.css']
})
export class FormularioDinamicoComponent implements OnInit, OnChanges {
  @Input() schema: any; 
  @Input() initialData: any;
  @Input() instancia: any;
  @Input() taskId: string = ''; // ID de Definición (UML)
  @Input() taskInstanceId: string = ''; // ID de Instancia (MongoDB)
  @Input() isDesignMode: boolean = false;
  @Input() isAuditMode: boolean = false;
  @Input() isPortalMode: boolean = false; // MODO LIMPIO PARA CLIENTES
  @Input() highlightId: string | null = null;

  @Output() submitted = new EventEmitter<any>();
  @Output() closed = new EventEmitter<void>();
  @Output() fieldHovered = new EventEmitter<string | null>();

  @ViewChild('viewerContent') viewerContent!: ElementRef;

  form: FormGroup = new FormGroup({});
  fields: any[] = [];
  documentos: any[] = [];
  selectedDoc: any = null;
  versionesHistoricas: any[] = []; // Solo las versiones viejas del doc seleccionado
  documentosAgrupados: any[] = []; // Solo los actuales para el listado principal
  
  zoomLevel: number = 1.0;
  isPdf: boolean = false;
  isTxt: boolean = false;
  uploadingField: string | null = null;

  // IA Voice & Processing
  isListening: boolean = false;
  procesandoVoz: boolean = false;
  cargandoEvidencias: boolean = false;
  mostrarConfirmarVoz: boolean = false;
  mostrarTodoIA: boolean = true; // ACTIVADO POR DEFECTO
  activeFieldId: string | null = null; // CAMPO EN FOCO
  transcriptTemp: string = '';
  private recognition: any;

  // Evidencias IA
  highlightsIA: any[] = [];

  // Gestión de Documentos Colaborativos (NUEVO)
  showDocInfo: boolean = false;
  docInfoTarget: any = null;

  // LAYOUT RESIZING (NUEVO)
  dmsWidth: number = 280;
  formWidthPercent: number = 35; // Formulario empieza pequeño como pediste
  isResizingDMS: boolean = false;
  isResizingPanels: boolean = false;

  // Gestión de Versiones modo Árbol (Context Menu)
  contextMenuVisible: boolean = false;
  contextMenuX: number = 0;
  contextMenuY: number = 0;
  contextMenuDoc: any = null;
  expandedDocs: Set<string> = new Set(); // IDs de docs con versiones expandidas

  getDocsCliente() {
    return this.documentosAgrupados.filter(d => !d.esColaborativo);
  }

  getDocsFuncionario() {
    return this.documentosAgrupados.filter(d => d.esColaborativo);
  }

  toggleVersionesArbol(docId: string) {
    if (this.expandedDocs.has(docId)) {
        this.expandedDocs.delete(docId);
    } else {
        this.expandedDocs.add(docId);
    }
    this.cdr.detectChanges();
  }

  getVersionesDe(doc: any) {
    const padreId = doc.documentoPadreId || doc.id;
    return this.documentos.filter(d => 
        (d.documentoPadreId === padreId || d.id === padreId) && d.id !== doc.id
    ).sort((a, b) => (b.version || 0) - (a.version || 0));
  }

  onRightClickDoc(event: MouseEvent, doc: any) {
    event.preventDefault();
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.contextMenuDoc = doc;
    this.contextMenuVisible = true;
  }

  @HostListener('window:click')
  closeContextMenu() {
    this.contextMenuVisible = false;
  }

  getGridColumns(): string {
    if (this.isPortalMode || this.isDesignMode) return '1fr';
    if (this.selectedDoc?.esColaborativo) {
        return `${this.dmsWidth}px 1fr`; // MODO REDUCCIÓN: DMS y el resto para el Editor
    }
    return `${this.dmsWidth}px 10px ${this.formWidthPercent}% 10px 1fr`;
  }

  // --- LÓGICA DE REDIMENSIONAMIENTO ---
  startResizingDMS(event: MouseEvent) {
    this.isResizingDMS = true;
    event.preventDefault();
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent) {
    if (this.isResizingDMS) {
      this.dmsWidth = Math.max(200, Math.min(600, event.clientX));
      this.cdr.detectChanges();
    } else if (this.isResizingPanels) {
      const containerWidth = window.innerWidth - this.dmsWidth;
      const mouseXRelative = event.clientX - this.dmsWidth;
      this.formWidthPercent = Math.max(20, Math.min(80, (mouseXRelative / containerWidth) * 100));
      this.cdr.detectChanges();
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp() {
    this.isResizingDMS = false;
    this.isResizingPanels = false;
  }

  startResizingPanels(event: MouseEvent) {
    this.isResizingPanels = true;
    event.preventDefault();
  }

  onMouseWheel(event: WheelEvent) {
    if (event.ctrlKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      this.setZoom(delta);
    }
  }

  verInfoDocumento(event: MouseEvent, doc: any) {
    event.stopPropagation();
    this.docInfoTarget = doc;
    this.showDocInfo = true;
    this.cdr.detectChanges();
  }

  prepararNuevoDocumento() {
    const nombre = prompt("Ingrese un nombre para el nuevo documento:", "Resolución_Gestión");
    if (!nombre) return;

    // Crear un objeto documento temporal (Placeholder)
    const nuevoDoc = {
        id: 'new-' + new Date().getTime(),
        nombreArchivo: nombre + '.html',
        esColaborativo: true,
        esActual: true,
        version: 1,
        funcionarioNombre: 'Tú',
        departamentoNombre: 'Área de Gestión',
        contenidoHtml: '', // Nace vacío para que la IA lo llene o el usuario redacte
        tipoDocumento: 'GESTION_FUNCIONARIO'
    };

    // Añadirlo temporalmente al listado para que sea visible en el árbol
    this.documentos.push(nuevoDoc);
    this.documentosAgrupados.push(nuevoDoc);
    this.selectDoc(nuevoDoc);
    this.cdr.detectChanges();
  }

  handleDocFinalized() {
    this.selectedDoc = null;
    this.cargarDocumentos();
    this.cdr.detectChanges();
  }

  getIcon(filename: string): string {
    if (!filename) return 'description';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['png', 'jpg', 'jpeg'].includes(ext || '')) return 'image';
    return 'description';
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private snackBar: MatSnackBar, private bpmsService: BpmsService) {}

  ngOnInit() {
    this.rebuildForm();
    this.cargarDocumentos();
    this.initVoiceRecognition();
  }

  cargarDocumentos() {
    if (!this.instancia?.clienteCi) return;
    let url = `http://localhost:8080/api/documentos/cliente/${this.instancia.clienteCi}`;
    if (this.instancia.id) url += `?instanciaId=${this.instancia.id}`;
    
    this.http.get<any[]>(url)
      .subscribe(res => {
        this.documentos = res;
        // Solo mostrar los actuales en el listado principal
        this.documentosAgrupados = res.filter(d => d.esActual);
        
        if (this.documentosAgrupados.length > 0 && !this.selectedDoc) {
          this.selectDoc(this.documentosAgrupados[0]);
        }
        this.cdr.detectChanges();
      });
  }

  selectDoc(doc: any) {
    this.selectedDoc = doc;
    const name = doc.nombreArchivo.toLowerCase();
    this.isPdf = name.endsWith('.pdf');
    this.isTxt = name.endsWith('.txt');
    this.zoomLevel = 1.0;

    // Buscar versiones anteriores del mismo tipo/padre
    const padreId = doc.documentoPadreId || doc.id;
    this.versionesHistoricas = this.documentos
      .filter(d => (d.documentoPadreId === padreId || d.id === padreId) && d.id !== doc.id)
      .sort((a, b) => (b.version || 0) - (a.version || 0));

    console.log(`[DEBUG] Documento seleccionado: ${doc.nombreArchivo} (V${doc.version})`);
    this.cdr.detectChanges();
  }

  // ACCIONES DE FUNCIONARIO (FASE 3)
  observarDocumento() {
    if (!this.selectedDoc) return;
    const motivo = prompt("Ingrese el motivo de la observación:");
    if (!motivo) return;

    this.http.post(`http://localhost:8080/api/documentos/${this.selectedDoc.id}/observar`, { motivo })
      .subscribe(() => {
        this.selectedDoc.estadoDocumento = 'OBSERVADO';
        this.selectedDoc.motivoObservacion = motivo;
        this.snackBar.open("⚠️ Documento observado correctamente", "OK", { duration: 3000 });
        this.cargarDocumentos();
        this.cdr.detectChanges();
      });
  }

  aprobarDocumento() {
    if (!this.selectedDoc) return;
    this.http.post(`http://localhost:8080/api/documentos/${this.selectedDoc.id}/aprobar`, {})
      .subscribe(() => {
        this.selectedDoc.estadoDocumento = 'APROBADO';
        this.selectedDoc.motivoObservacion = null;
        this.snackBar.open("✅ Documento aprobado", "OK", { duration: 3000 });
        this.cargarDocumentos();
        this.cdr.detectChanges();
      });
  }

  // --- CONFIGURADOR DE SUBSANACIÓN (FASE 4.1) ---
  mostrarConfigurador: boolean = false;
  configuradorCampos: any[] = [];

  abrirConfiguradorSubsanacion() {
    console.log(">> [DEBUG] Abriendo configurador de subsanación...");
    if (!this.instancia) {
        console.error("No hay instancia cargada");
        return;
    }

    const abrirConSchema = (schemaJson: string) => {
        try {
            const schema = JSON.parse(schemaJson);
            this.configuradorCampos = schema.map((field: any) => ({
                id: field.id,
                label: field.label,
                type: field.type,
                observado: false,
                motivo: ''
            }));
            this.mostrarConfigurador = true;
            this.cdr.detectChanges();
            console.log(">> [DEBUG] Configurador abierto con campos:", this.configuradorCampos.length);
        } catch (e) {
            this.snackBar.open("Error al procesar campos del formulario.", "OK");
        }
    };

    if (this.instancia.politicaNegocioId) {
        this.bpmsService.listarTareasPoliticaPublicas(this.instancia.politicaNegocioId).subscribe({
            next: (tareas: any[]) => {
                const firstTask = tareas[0];
                if (firstTask) {
                    this.bpmsService.generarFormularioPublico(this.instancia.politicaNegocioId, firstTask.id).subscribe(abrirConSchema);
                } else {
                    abrirConSchema(this.schema); // Fallback al schema actual
                }
            },
            error: () => abrirConSchema(this.schema)
        });
    } else {
        abrirConSchema(this.schema);
    }
  }

  cerrarConfigurador() {
    this.mostrarConfigurador = false;
    this.configuradorCampos = [];
    this.cdr.detectChanges();
  }

  enviarSubsanacion() {
    const observaciones: any = {};
    let hayObservaciones = false;

    this.configuradorCampos.forEach(c => {
      if (c.observado) {
        observaciones[c.id] = c.motivo || 'Sin motivo especificado';
        hayObservaciones = true;
      }
    });

    if (!hayObservaciones) {
      this.snackBar.open("Debe observar al menos un campo para solicitar subsanación.", "OK", { duration: 3000 });
      return;
    }

    this.bpmsService.solicitarSubsanacion(this.taskInstanceId, observaciones).subscribe({
      next: () => {
        this.snackBar.open("📢 Trámite enviado a subsanación. Se notificará al cliente.", "OK", { duration: 5000 });
        this.mostrarConfigurador = false;
        this.closed.emit(); // Cerrar el formulario principal
      },
      error: () => this.snackBar.open("Error al enviar solicitud de subsanación.", "OK")
    });
  }

  // ACCIONES DE FUNCIONARIO PARA CAMPOS DE DATOS (ANTIGUOS - SE MANTIENEN POR SI ACASO, PERO EL FLUJO PRINCIPAL AHORA ES EL MODAL)

  observarCampo(fieldId: string) {
    if (!this.instancia?.id) return;
    const motivo = prompt(`Ingrese el motivo de observación para el campo:`);
    if (!motivo) return;

    this.http.post(`http://localhost:8080/api/instancias/${this.instancia.id}/observar-campo?fieldId=${fieldId}&motivo=${motivo}`, {})
      .subscribe((res: any) => {
        this.instancia = res; // Actualizar instancia con nuevas observaciones
        this.snackBar.open("⚠️ Campo observado", "OK", { duration: 3000 });
        this.cdr.detectChanges();
      });
  }

  aprobarCampo(fieldId: string) {
    if (!this.instancia?.id) return;
    this.http.post(`http://localhost:8080/api/instancias/${this.instancia.id}/aprobar-campo?fieldId=${fieldId}`, {})
      .subscribe((res: any) => {
        this.instancia = res;
        this.snackBar.open("✅ Campo aprobado", "OK", { duration: 3000 });
        this.cdr.detectChanges();
      });
  }

  esCampoObservado(fieldId: string): boolean {
    return this.instancia?.observacionesCampos && this.instancia.observacionesCampos[fieldId];
  }

  getMotivoCampo(fieldId: string): string {
    return this.instancia?.observacionesCampos ? this.instancia.observacionesCampos[fieldId] : '';
  }

  solicitarSubsanacion() {
    if (!this.taskInstanceId) return;
    if (!confirm("¿Está seguro de enviar este trámite a subsanación por el ciudadano?")) return;

    this.http.post(`http://localhost:8080/api/instancias/tareas/${this.taskInstanceId}/solicitar-subsanacion`, {})
      .subscribe(() => {
        this.snackBar.open("📢 Trámite enviado a subsanación. Se notificará al cliente.", "OK", { duration: 5000 });
        this.closed.emit(); // Cerrar el formulario
      });
  }

  setZoom(delta: number) {
    this.zoomLevel = Math.max(0.5, Math.min(3.0, this.zoomLevel + delta));
    this.cdr.detectChanges();
  }

  autoFit() {
    const canvas = this.viewerContent?.nativeElement;
    const img = document.querySelector('.doc-img') as HTMLImageElement;
    if (canvas && img && img.naturalWidth > 0) {
        const containerWidth = canvas.clientWidth - 40; // Ajuste por padding
        this.zoomLevel = containerWidth / img.naturalWidth;
    } else {
        this.zoomLevel = 1.0;
    }
    this.cdr.detectChanges();
  }

  onFieldFocus(fieldId: string) {
    this.activeFieldId = fieldId;
    console.log(`[DEBUG] Campo enfocado: ${fieldId}`);
    this.fieldHovered.emit(fieldId);

    // Lógica de Salto Automático
    const h = this.highlightsIA.find(h => h.fieldId === fieldId);
    if (h && h.docId) {
      console.log(`[DEBUG] El campo ${fieldId} tiene evidencia en docId: ${h.docId}`);
      if (!this.selectedDoc || this.selectedDoc.id !== h.docId) {
        const targetDoc = this.documentos.find(d => d.id === h.docId);
        if (targetDoc) {
          console.log(`🚀 [IA-NAVEGACIÓN] Saltando al documento: ${targetDoc.nombreArchivo}`);
          this.selectDoc(targetDoc);
        }
      }
    } else {
      console.log(`[DEBUG] El campo ${fieldId} no tiene evidencia IA registrada.`);
    }
    this.cdr.detectChanges();
  }

  onCanvasClick() {
    console.log(`[DEBUG] Click en lienzo - Limpiando foco`);
    this.activeFieldId = null;
    this.cdr.detectChanges();
  }

  onToggleMostrarTodo() {
    console.log(`[DEBUG] Switch MOSTRAR TODO: ${this.mostrarTodoIA}`);
    this.cdr.detectChanges();
  }

  onFileChange(event: any, fieldId: string) {
    const file = event.target.files[0];
    if (file) {
      this.uploadingField = fieldId;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clienteCi', this.instancia?.clienteCi || 'CI-PROVISORIO');
      formData.append('tipoDocumento', fieldId.toUpperCase());
      
      if (this.instancia?.id) formData.append('instanciaId', this.instancia.id);
      if (this.instancia?.politicaNegocioId) formData.append('politicaId', this.instancia.politicaNegocioId);

      this.http.post<any>('http://localhost:8080/api/documentos/subir', formData).subscribe({
        next: (res) => {
          this.uploadingField = null;
          
          // ACTUALIZAR EL VALOR DEL FORMULARIO PARA DESBLOQUEAR EL BOTÓN ENVIAR
          if (this.form.controls[fieldId]) {
            this.form.controls[fieldId].setValue(res.urlS3 || 'CARGADO');
          }

          this.cargarDocumentos();
          this.cdr.detectChanges();
          this.snackBar.open("✅ Archivo subido y analizado", "OK", { duration: 3000 });
        },
        error: () => {
          this.uploadingField = null;
          this.cdr.detectChanges();
          this.snackBar.open("❌ Error al subir archivo", "Entendido");
        }
      });
    }
  }

  initVoiceRecognition() {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.continuous = true; 
      this.recognition.interimResults = true; 
      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            this.transcriptTemp = event.results[i][0].transcript;
            this.mostrarConfirmarVoz = true; 
            this.isListening = false;
            this.recognition.stop(); 
          }
        }
        this.cdr.detectChanges();
      };
      this.recognition.onstart = () => { this.isListening = true; this.cdr.detectChanges(); };
      this.recognition.onend = () => { this.isListening = false; this.cdr.detectChanges(); };
      this.recognition.onerror = () => { this.isListening = false; this.cdr.detectChanges(); };
    }
  }

  toggleMic() {
    if (!this.recognition) return;
    this.isListening ? this.recognition.stop() : this.recognition.start();
    this.cdr.detectChanges();
  }

  confirmarComandoVoz() {
    this.mostrarConfirmarVoz = false;
    this.procesarComandoVoz(this.transcriptTemp);
  }

  cancelarComandoVoz() {
    this.mostrarConfirmarVoz = false;
    this.transcriptTemp = '';
    this.cdr.detectChanges();
  }

  procesarComandoVoz(transcript: string) {
    if (!this.instancia) return;
    this.procesandoVoz = true;
    this.highlightsIA = [];
    this.cdr.detectChanges();

    const payload = {
      politicaId: this.instancia.politicaNegocioId || this.instancia.id,
      taskId: this.taskId,
      clienteCi: this.instancia.clienteCi,
      instanciaId: this.instancia.id,
      voiceInstruction: transcript
    };

    // PASO 1: RELLENO RÁPIDO
    this.http.post<any>('http://localhost:8080/api/documentos/procesar-voz-contexto', payload)
      .subscribe({
        next: (res) => {
          console.log(">> [IA-FRONTEND] Relleno rápido:", res);
          Object.keys(res).forEach(key => {
            if (this.form.controls[key]) {
              const val = res[key].valor;
              if (val && val !== "null") {
                this.form.controls[key].setValue(val);
                console.log(`>> [IA-FRONTEND] Campo ${key} set con: ${val}`);
              }
            }
          });
          this.procesandoVoz = false;
          this.cargandoEvidencias = true;
          this.cdr.detectChanges();
          this.obtenerEvidenciasVisuales(res, payload.clienteCi);
        },
        error: () => { this.procesandoVoz = false; this.cdr.detectChanges(); }
      });
  }

  private obtenerEvidenciasVisuales(jsonResult: any, clienteCi: string) {
    const payloadEvidencias = { 
      jsonResult: JSON.stringify(jsonResult), 
      clienteCi: clienteCi,
      instanciaId: this.instancia.id 
    };
    this.http.post<any>('http://localhost:8080/api/documentos/obtener-evidencias-ia', payloadEvidencias)
      .subscribe({
        next: (evidencias) => {
          console.log(">> [IA-FRONTEND] Evidencias recibidas:", evidencias);
          this.highlightsIA = [];
          Object.keys(evidencias).forEach(key => {
            const data = evidencias[key];
            if (data && data.coords) {
              // ESCALA 0-1000 a % (dividir entre 10)
              const visualCoords = {
                x: data.coords.x / 10,
                y: data.coords.y / 10,
                w: data.coords.w / 10,
                h: data.coords.h / 10
              };
              
              console.log(`🎯 [DEBUG-UI] Dibujando ${key}:`, visualCoords);
              this.highlightsIA.push({ 
                label: `IA: ${key}`, 
                coords: visualCoords, 
                fieldId: key,
                docId: data.docId // MAPEO DE DOC ID PARA SALTO AUTOMÁTICO
              });
            }
          });
          this.cargandoEvidencias = false;
          this.cdr.detectChanges();
        },
                error: () => { this.cargandoEvidencias = false; this.cdr.detectChanges(); }
      });
  }

  private rebuildForm() {
    try {
      this.fields = JSON.parse(this.schema || '[]');
      const group: any = {};
      this.fields.forEach(field => {
        if (field.type !== 'button') group[field.id] = new FormControl('', field.required ? Validators.required : null);
      });
      this.form = new FormGroup(group);
      if (this.initialData) this.form.patchValue(this.initialData);
    } catch (e) { this.fields = []; }
  }

  ngOnChanges(changes: SimpleChanges) { if (changes['schema'] || changes['initialData']) this.rebuildForm(); }
  onSubmit() { if (this.form.valid) this.submitted.emit(this.form.value); }
  close() { this.closed.emit(); }
}
