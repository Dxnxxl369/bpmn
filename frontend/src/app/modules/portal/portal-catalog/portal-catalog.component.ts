import { Component, OnInit, ViewChild, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BpmsService, PoliticaNegocio } from '../../../services/bpms.service';
import { FormularioDinamicoComponent } from '../../../components/formulario-dinamico/formulario-dinamico.component';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-portal-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatDialogModule, MatProgressBarModule, MatSnackBarModule, FormularioDinamicoComponent],
  templateUrl: './portal-catalog.component.html',
  styleUrls: ['./portal-catalog.component.css']
})
export class PortalCatalogComponent implements OnInit {
  @ViewChild('dialogInicio') dialogInicio!: TemplateRef<any>;
  @ViewChild('dialogEnCurso') dialogEnCurso!: TemplateRef<any>;

  servicios: PoliticaNegocio[] = [];
  serviciosFiltrados: PoliticaNegocio[] = [];
  busqueda: string = '';
  tokenBusqueda: string = '';
  isDarkMode: boolean = false;

  servicioSeleccionado: PoliticaNegocio | null = null;
  schemaCliente: string = '';
  taskIdActual: string = '';
  errorCarga: boolean = false;
  
  // --- IDENTIFICACIÓN PASO 0 ---
  identificado: boolean = false;
  ciCiudadano: string = '';
  instanciaIdExistente: string | null = null;
  tieneObservaciones: boolean = false;
  modoSubsanacion: boolean = false;
  observacionesDetalle: any[] = [];

  // --- SMART TRIAGE ---
  isListening: boolean = false;
  procesandoTriage: boolean = false;
  recomendacionIA: any = null;
  private recognition: any;

  constructor(
    private bpmsService: BpmsService,
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.cargarServicios();
    this.isDarkMode = document.body.classList.contains('dark-mode');
    this.initVoiceRecognition();

    // FASE 4: Detectar si viene de un redireccionamiento de subsanación
    this.route.queryParams.subscribe((params: any) => {
      if (params['ci'] && params['fix']) {
        this.ciCiudadano = params['ci'];
        // Esperamos a que los servicios carguen para abrir el correcto
        const checkServices = setInterval(() => {
          if (this.servicios.length > 0) {
            const target = this.servicios.find(s => s.id === params['fix']);
            if (target) {
              this.abrirDialogoInicio(target);
              this.confirmarIdentidad();
            }
            clearInterval(checkServices);
          }
        }, 500);
      }
    });
  }

  initVoiceRecognition() {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.busqueda = transcript;
        this.ejecutarTriageIA(transcript);
      };
      this.recognition.onend = () => { this.isListening = false; this.cdr.detectChanges(); };
    }
  }

  toggleMic() {
    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.isListening = true;
      this.recognition.start();
    }
  }

  ejecutarTriageIA(mensaje: string) {
    this.procesandoTriage = true;
    this.cdr.detectChanges();
    this.bpmsService.triageIA(mensaje).subscribe({
      next: (res) => {
        this.recomendacionIA = res;
        this.procesandoTriage = false;
        if (res.politicaId) {
          this.snackBar.open("✨ IA recomienda un trámite", "OK", { duration: 5000 });
        }
        this.cdr.detectChanges();
      },
      error: () => { this.procesandoTriage = false; this.cdr.detectChanges(); }
    });
  }

  cargarServicios() {
    // Usamos el endpoint público que devuelve solo políticas ACTIVAS
    this.bpmsService.listarPoliticasPublicas().subscribe({
      next: (data) => {
        this.servicios = data;
        this.serviciosFiltrados = [...this.servicios];
        this.cdr.detectChanges();
      }
    });
  }

  filtrar() {
    const term = this.busqueda.toLowerCase();
    this.serviciosFiltrados = this.servicios.filter(s => 
      s.nombre.toLowerCase().includes(term) || 
      s.descripcion.toLowerCase().includes(term)
    );
  }

  abrirDialogoInicio(s: PoliticaNegocio) {
    this.servicioSeleccionado = s;
    this.schemaCliente = '';
    this.errorCarga = false;
    this.identificado = false; // Reset identificación
    this.ciCiudadano = '';

    this.dialog.open(this.dialogInicio, {
      width: '95vw',
      maxWidth: '100vw',
      height: '85vh',
      panelClass: 'custom-dialog-fullscreen',
      disableClose: true
    });
  }

  confirmarIdentidad() {
    if (!this.ciCiudadano || this.ciCiudadano.length < 5) {
      this.snackBar.open('Ingrese un C.I. válido', 'OK', { duration: 2000 });
      return;
    }

    // FASE 1: Verificar si ya tiene un trámite en curso
    if (this.servicioSeleccionado?.id) {
      this.bpmsService.verificarEstadoTramite(this.ciCiudadano, this.servicioSeleccionado.id).subscribe(res => {
        if (res.enCurso) {
          this.instanciaIdExistente = res.instanciaId;
          this.tieneObservaciones = res.tieneObservaciones;
          this.observacionesDetalle = res.observaciones || [];
          
          this.dialog.closeAll();
          this.dialog.open(this.dialogEnCurso, { width: '450px', panelClass: 'custom-alert-dialog' });
          this.cdr.detectChanges();
        } else {
          this.identificado = true;
          this.modoSubsanacion = false;
          this.instanciaIdExistente = null;
          this.cdr.detectChanges();
          this.cargarFormularioInicial();
        }
      });
    }
  }

  iniciarSubsanacion() {
    this.dialog.closeAll();
    this.identificado = true;
    this.modoSubsanacion = true;
    
    // RE-ABRIR EL DIÁLOGO DE INICIO PARA MOSTRAR EL FORMULARIO
    this.dialog.open(this.dialogInicio, {
      width: '650px',
      panelClass: 'custom-dialog-container',
      disableClose: true
    });
    
    this.cdr.detectChanges();
    this.cargarFormularioInicial();
  }

  cargarFormularioInicial() {
    if (!this.servicioSeleccionado?.id) return;

    this.bpmsService.listarTareasPoliticaPublicas(this.servicioSeleccionado.id).subscribe({
      next: (tareas) => {
        const firstTask = tareas[0];
        if (firstTask) {
          this.taskIdActual = firstTask.id;
          // PASAMOS EL instanciaId si existe para el bloqueo dinámico
          this.bpmsService.generarFormularioPublico(this.servicioSeleccionado!.id!, firstTask.id, this.instanciaIdExistente || undefined).subscribe(schema => {
            if (schema && schema !== '[]') {
              this.schemaCliente = schema;
              this.errorCarga = false;
            } else {
              this.errorCarga = true;
            }
            this.cdr.detectChanges();
          });
        } else {
          this.errorCarga = true;
          this.cdr.detectChanges();
        }
      },
      error: () => { this.errorCarga = true; this.cdr.detectChanges(); }
    });
  }

  confirmarInicio(respuestas: any) {
    if (!this.servicioSeleccionado?.id) return;

    if (this.modoSubsanacion && this.instanciaIdExistente) {
      this.bpmsService.enviarSubsanacion(this.instanciaIdExistente, JSON.stringify(respuestas)).subscribe({
        next: () => {
          this.dialog.closeAll();
          this.snackBar.open("✅ Correcciones enviadas con éxito. El funcionario revisará su trámite.", "CERRAR", { duration: 7000 });
          this.router.navigate(['/portal/seguimiento', this.instanciaIdExistente]);
        },
        error: () => alert('Error al enviar correcciones.')
      });
    } else {
      this.bpmsService.iniciarTramiteExterno(this.servicioSeleccionado.id, JSON.stringify(respuestas), this.ciCiudadano).subscribe({
        next: (res) => {
          this.dialog.closeAll();
          this.router.navigate(['/portal/seguimiento', res.token]);
        },
        error: () => alert('Error al procesar la solicitud con el motor BPMN.')
      });
    }
  }

  // --- LOGICA DE ARCHIVOS Y MAGIC FILL ---
  fileUploaded = false;
  fileName = '';
  fileUrl: string | null = null;
  procesandoIA = false;
  respuestasIA: any = null;

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.fileUploaded = true;
      this.fileName = file.name;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.fileUrl = e.target.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  ejecutarMagicFill() {
    if (!this.schemaCliente) return;
    this.procesandoIA = true;
    this.bpmsService.predecirRespuestasIA(this.schemaCliente, "DATOS DE DOCUMENTO CIUDADANO").subscribe({
      next: (res) => {
        this.respuestasIA = res;
        this.procesandoIA = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.procesandoIA = false;
        this.snackBar.open('Error al extraer datos', 'OK', { duration: 3000 });
      }
    });
  }

  irASeguimiento() { this.router.navigate(['/portal/seguimiento', this.tokenBusqueda]); }
}
