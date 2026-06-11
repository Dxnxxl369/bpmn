import { Component, OnInit, Inject, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BpmsService, PoliticaNegocio, Departamento } from '../../services/bpms.service';
import { AuthService } from '../../services/auth.service';
import { FormularioDinamicoComponent } from '../formulario-dinamico/formulario-dinamico.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-atencion-ventanilla',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatSelectModule, MatProgressBarModule, MatInputModule, MatFormFieldModule, FormularioDinamicoComponent],
  templateUrl: './atencion-ventanilla.component.html',
  styleUrls: ['./atencion-ventanilla.component.css']
})
export class AtencionVentanillaComponent implements OnInit {
  catalog: PoliticaNegocio[] = [];
  misDepartamentosIds: string[] = [];
  politicaSeleccionada: PoliticaNegocio | null = null;
  schema: string = '[]';
  taskIdActual: string = '';
  fileUploaded: boolean = false;
  fileName: string = '';
  procesandoIA: boolean = false;
  respuestasIA: any = null;
  instruccionEjecutivo: string = '';

  // --- IDENTIFICACIÓN PASO 0 ---
  identificado: boolean = false;
  ciCiudadano: string = '';

  constructor(
    public dialogRef: MatDialogRef<AtencionVentanillaComponent>,
    private bpmsService: BpmsService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  confirmarIdentidad() {
    if (!this.ciCiudadano || this.ciCiudadano.length < 5) {
      this.snackBar.open('Ingrese un C.I. válido', 'OK', { duration: 2000 });
      return;
    }
    this.identificado = true;
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.authService.user$.subscribe((user: any) => {
      if (user) {
        // PRIORIDAD: Si tiene departamentoIds los usamos, si no, usamos su laneId principal
        this.misDepartamentosIds = user.departamentoIds || [];
        const miLaneIdPrincipal = user.laneId;

        this.bpmsService.listarDepartamentos().subscribe(allDepts => {
          // 1. Obtener nombres de mis departamentos asignados
          let misNombres = allDepts
            .filter(d => this.misDepartamentosIds.includes(d.id!))
            .map(d => this.normalizar(d.nombreNormalizado));

          // 2. Fallback: Si no hay IDs pero hay laneId, lo sumamos
          if (miLaneIdPrincipal && !misNombres.includes(this.normalizar(miLaneIdPrincipal))) {
            misNombres.push(this.normalizar(miLaneIdPrincipal));
          }

          console.log("DEBUG VENTANILLA - Mis departamentos para filtrar:", misNombres);
          this.filtrarTramitesConNombres(misNombres);
        });
      }
    });
  }

  // Función para normalizar texto (match con backend)
  private normalizar(texto: string): string {
    if (!texto) return '';
    return texto.toLowerCase()
      .replace(/[áäàâ]/g, "a")
      .replace(/[éëèê]/g, "e")
      .replace(/[íïìî]/g, "i")
      .replace(/[óöòô]/g, "o")
      .replace(/[úüùû]/g, "u")
      .replace(/[ñ]/g, "n")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  }

  filtrarTramitesConNombres(misNombresDeptos: string[]) {
    this.bpmsService.listarPoliticas().subscribe(politicas => {
      const activas = politicas.filter(p => p.estado === 'ACTIVA');
      
      if (activas.length === 0 || misNombresDeptos.length === 0) {
        this.catalog = [];
        this.cdr.detectChanges();
        return;
      }

      const promesas = activas.map(p => 
        this.bpmsService.listarTareasPolitica(p.id!).pipe(catchError(() => of([])))
      );

      forkJoin(promesas).subscribe(resultadoTareas => {
        this.catalog = activas.filter((p, index) => {
          const tareas = resultadoTareas[index];
          if (!tareas || tareas.length === 0) return false;

          // Si Jose es ADMINISTRADOR, ve todo. Si es FUNCIONARIO, filtramos.
          if (this.authService.getRol() === 'ADMINISTRADOR') return true;

          const algunMatch = tareas.some(t => {
            const laneTareaNormalizado = this.normalizar(t.lane);
            return misNombresDeptos.some(miDepto => 
              laneTareaNormalizado === miDepto || 
              laneTareaNormalizado.includes(miDepto) || 
              miDepto.includes(laneTareaNormalizado)
            );
          });
          
          return algunMatch;
        });
        
        console.log("Catálogo final para Jose:", this.catalog);
        this.cdr.detectChanges();
      });
    });
  }

  seleccionarTramite(p: PoliticaNegocio) {
    this.politicaSeleccionada = p;
    console.log("DEBUG: Seleccionando trámite:", p.nombre, "ID:", p.id);
    this.bpmsService.listarTareasPolitica(p.id!).subscribe({
      next: (tareas) => {
        if (tareas && tareas.length > 0) {
          const primeraTarea = tareas[0];
          this.taskIdActual = primeraTarea.id;
          console.log("DEBUG: Cargando formulario para primera tarea:", primeraTarea.nombre, "ID:", primeraTarea.id);
          this.bpmsService.generarFormulario(p.id!, primeraTarea.id).subscribe({
            next: (schema) => {
              this.schema = schema;
              console.log("DEBUG: Formulario cargado con éxito.");
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error("ERROR: No se pudo cargar el formulario:", err);
              this.snackBar.open('No hay un formulario LISTO para este trámite.', 'OK', { duration: 5000 });
            }
          });
        } else {
          console.warn("ADVERTENCIA: Esta política no tiene tareas configuradas.");
        }
      },
      error: (err) => console.error("ERROR: No se pudieron listar las tareas:", err)
    });
  }

  fileUrl: string | null = null;

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.fileUploaded = true;
      this.fileName = file.name;
      
      // Generate URL for preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.fileUrl = e.target.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  ejecutarMagicFill() {
    this.procesandoIA = true;
    this.snackBar.open('✨ IA está procesando el documento...', 'OK', { duration: 2000 });
    
    const docTextSimulado = "DATOS DEL DOCUMENTO CARGADO PARA MAGIC FILL";
    const promptFull = `DOCUMENTO: ${docTextSimulado}. INSTRUCCION EJECUTIVO: ${this.instruccionEjecutivo}`;
    
    this.bpmsService.predecirRespuestasIA(this.schema, promptFull).subscribe({
      next: (res) => {
        this.respuestasIA = res;
        this.procesandoIA = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.procesandoIA = false;
        this.snackBar.open('❌ Error de comunicación con IA', 'OK', { duration: 3000 });
      }
    });
  }

  finalizarTramite(respuestas: any) {
    if (!this.politicaSeleccionada?.id) return;
    
    const userEmail = this.authService.getEmail();
    
    // Pasamos el ciCiudadano capturado en el Paso 0
    this.bpmsService.iniciarTramitePresencial(this.politicaSeleccionada.id, JSON.stringify(respuestas), this.ciCiudadano, userEmail).subscribe({
      next: () => {
        this.snackBar.open('🚀 Trámite iniciado con éxito.', 'OK', { duration: 5000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error("ERROR AL INICIAR TRÁMITE:", err);
        const errorMsg = err.error?.error || 'No tienes permiso para iniciar este trámite.';
        this.snackBar.open(`❌ ${errorMsg}`, 'Cerrar', { duration: 7000, panelClass: ['snack-error-premium'] });
      }
    });
  }

  resetVentanilla() {
    this.politicaSeleccionada = null;
    this.identificado = false;
    this.ciCiudadano = '';
    this.schema = '[]';
    this.cdr.detectChanges();
  }
}
