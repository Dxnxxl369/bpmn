import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BpmsService } from '../../services/bpms.service';
import { RxStomp } from '@stomp/rx-stomp';
import { Subscription } from 'rxjs';
import { FormularioDinamicoComponent } from '../formulario-dinamico/formulario-dinamico.component';
import { AtencionVentanillaComponent } from '../atencion-ventanilla/atencion-ventanilla.component';
import { DocumentEditorComponent } from '../document-editor/document-editor.component';
import { AuthService } from '../../services/auth.service';
import * as SockJSModule from 'sockjs-client';
const SockJSClass = (SockJSModule as any).default || SockJSModule;

@Component({
  selector: 'app-funcionario-monitor',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatDialogModule, FormularioDinamicoComponent, DocumentEditorComponent],
  template: `
    <div class="monitor-shell animate-fade-up">
      <!-- VISTA DE ATENCIÓN NORMAL (FORMULARIO DINÁMICO) -->
      <div class="atencion-overlay" *ngIf="activeTask && !isFinalDocMode">
        <app-formulario-dinamico 
          [schema]="activeSchema" 
          [instancia]="activeInstancia" 
          [taskId]="activeTask.taskDefinitionId"
          [taskInstanceId]="activeTask.id"
          [isAuditMode]="true"
          (submitted)="handleFormSubmission($event)"
          (closed)="cancelarAtencion()">
        </app-formulario-dinamico>
      </div>

      <!-- VISTA DE EDITOR COLABORATIVO (FASE FINAL) -->
      <div class="atencion-overlay" *ngIf="activeTask && isFinalDocMode">
          <app-document-editor
              [instanciaId]="activeInstancia?.id"
              [tareaId]="activeTask.id"
              [contextoJson]="contextoParseado"
              (completed)="handleDocSubmission()"
              (cancelled)="cancelarAtencion()">
          </app-document-editor>
      </div>

      <header class="monitor-header" *ngIf="!activeTask">
        <div class="header-top-row">
          <div class="pill-premium">Área Operativa Digital</div>
          <button class="btn-ventanilla-premium" (click)="abrirVentanilla()">
             <mat-icon>store</mat-icon> 
             <span>ATENCIÓN EN VENTANILLA</span>
             <mat-icon class="arrow-icon">chevron_right</mat-icon>
          </button>
        </div>
        <h1>Monitor de <span>Gestión</span></h1>
        <p>Departamentos Activos: <strong>{{ misLanes.join(', ') }}</strong></p>
      </header>

      <!-- CONTENEDOR CON SCROLL HORIZONTAL -->
      <div class="monitor-viewport">
        <div class="columns-grid">
          <!-- PENDIENTES -->
          <div class="status-column">
            <div class="column-head c-pendientes">
              <mat-icon>hourglass_empty</mat-icon>
              <span>Pendientes ({{ pendientes.length }})</span>
            </div>
            <div class="task-scroller scroll-custom">
              <mat-card *ngFor="let t of pendientes" class="modern-task-card p-border">
                <mat-card-header>
                  <mat-card-title>{{ t.nodoNombre }}</mat-card-title>
                  <mat-card-subtitle>ID: #{{ t.id.substring(0,8) }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="meta-item"><mat-icon>person</mat-icon> {{ t.solicitanteNombre || 'Anónimo' }}</div>
                  <div class="meta-item"><mat-icon>schedule</mat-icon> Enviado: {{ t.fechaInicio | date:'HH:mm:ss' }}</div>
                </mat-card-content>
                <div class="card-actions-premium">
                  <button class="btn-atender-premium" (click)='atenderTarea(t)'>
                    ATENDER <mat-icon>play_circle</mat-icon>
                  </button>
                </div>
              </mat-card>
            </div>
          </div>

          <!-- EN PROCESO -->
          <div class="status-column">
            <div class="column-head c-proceso">
              <mat-icon>sync</mat-icon>
              <span>En Atención ({{ enProceso.length }})</span>
            </div>
            <div class="task-scroller scroll-custom">
              <mat-card *ngFor="let t of enProceso" class="modern-task-card w-border">
                <mat-card-header>
                  <mat-card-title>{{ t.nodoNombre }}</mat-card-title>
                  <mat-card-subtitle>ID: #{{ t.id.substring(0,8) }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="meta-item"><mat-icon>person</mat-icon> {{ t.solicitanteNombre || 'Anónimo' }}</div>
                  <div class="meta-item"><mat-icon>update</mat-icon> Atendiendo hace {{ calcularTiempo(t.fechaAtencion || t.fechaInicio) }}</div>
                </mat-card-content>
                <div class="card-actions-premium" style="display: flex; gap: 5px; flex-direction: column;">
                  <button class="btn-continuar-premium" (click)='continuarTarea(t)'>
                    <mat-icon>edit_document</mat-icon> FORMULARIO
                  </button>
                </div>
              </mat-card>
            </div>
          </div>


          <!-- COMPLETADAS -->
          <div class="status-column">
            <div class="column-head c-fin">
              <mat-icon>check_circle</mat-icon>
              <span>Finalizadas ({{ completadas.length }})</span>
            </div>
            <div class="task-scroller scroll-custom">
              <mat-card *ngFor="let t of completadas" class="modern-task-card g-border">
                <mat-card-header>
                  <mat-card-title>{{ t.nodoNombre }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="meta-item"><mat-icon>done_all</mat-icon> Proceso concluido</div>
                  <div class="meta-item"><mat-icon>business</mat-icon> Depto: {{ t.laneId }}</div>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .monitor-shell { 
      padding: 0; 
      background: var(--bg-app); 
      height: 100vh; 
      width: 100%;
      display: flex; 
      flex-direction: column; 
      overflow: hidden;
      position: relative;
    }
    .monitor-header { text-align: center; padding: 30px 40px; margin-bottom: 0; flex-shrink: 0; }
    .monitor-header h1 { font-size: 2.5rem; font-weight: 900; margin: 15px 0 5px; color: var(--text-main); }
    .monitor-header h1 span { color: var(--primary-color); font-style: italic; }
    .monitor-header p { color: var(--text-muted); font-size: 0.9rem; letter-spacing: 1px; }

    .header-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1400px;
      margin: 0 auto;
    }

    .pill-premium {
      background: rgba(211, 84, 0, 0.1);
      color: var(--primary-color);
      padding: 8px 20px;
      border-radius: 30px;
      font-size: 0.75rem;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      border: 1px solid rgba(211, 84, 0, 0.2);
    }

    /* BOTON VENTANILLA PREMIUM */
    .btn-ventanilla-premium {
      background: linear-gradient(135deg, #2c3e50 0%, #000000 100%);
      color: white;
      border: none;
      padding: 12px 25px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .btn-ventanilla-premium span { font-weight: 950; font-size: 0.8rem; letter-spacing: 1px; }
    .btn-ventanilla-premium .arrow-icon { font-size: 18px; width: 18px; height: 18px; opacity: 0.5; transition: 0.3s; }
    .btn-ventanilla-premium:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 15px 35px rgba(0,0,0,0.4); }
    .btn-ventanilla-premium:hover .arrow-icon { opacity: 1; transform: translateX(5px); }

    .monitor-viewport {
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      display: flex;
      padding: 0 40px 30px;
      min-height: 0; /* CRÍTICO: Permite que el flex-child se encoja */
    }

    .columns-grid { 
      display: grid; 
      grid-template-columns: repeat(3, minmax(380px, 1fr)); 
      gap: 30px; 
      min-width: 1200px;
      height: 100%;
      min-height: 0; /* CRÍTICO */
    }

    .status-column { 
      background: var(--surface);
      border-radius: 32px; 
      padding: 25px; 
      border: 1px solid var(--glass-border); 
      display: flex; 
      flex-direction: column; 
      height: 100%;
      max-height: 100%; /* NO SE SALE DE LA PANTALLA */
      min-height: 0;    /* PERMITE SCROLL INTERNO */
      box-shadow: 0 15px 45px rgba(0,0,0,0.05);
    }

    .task-scroller {
      flex: 1;
      overflow-y: auto;
      padding-right: 12px;
      margin-right: -10px; /* Compensa el padding para que el scroll se vea pegado */
      padding-bottom: 20px;
    }

    /* SCROLLBAR PREMIUM */
    .scroll-custom::-webkit-scrollbar { width: 6px; }
    .scroll-custom::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    .scroll-custom::-webkit-scrollbar-thumb:hover { background: var(--primary-color); }

    .atencion-overlay {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: var(--bg-app);
      z-index: 2000;
      display: flex;
    }

    .column-head { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; padding: 0 5px; }
    .column-head mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .column-head span { font-weight: 950; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; }

    .c-pendientes { color: #64748b; border-bottom: 3px solid #f1f5f9; padding-bottom: 15px; }
    .c-proceso { color: var(--primary-color); border-bottom: 3px solid rgba(211, 84, 0, 0.1); padding-bottom: 15px; }
    .c-fin { color: #10b981; border-bottom: 3px solid rgba(16, 185, 129, 0.1); padding-bottom: 15px; }

    .modern-task-card {
      background: var(--bg-app) !important;
      border-radius: 24px !important;
      border: 1px solid var(--glass-border) !important;
      margin-bottom: 20px;
      padding: 10px 5px;
      transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
    }
    .modern-task-card:hover { transform: translateY(-8px) scale(1.01); box-shadow: 0 25px 50px rgba(0,0,0,0.15) !important; border-color: var(--primary-color) !important; }

    .p-border { border-left: 8px solid #64748b !important; }
    .w-border { border-left: 8px solid var(--primary-color) !important; }
    .g-border { border-left: 8px solid #10b981 !important; }

    .meta-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); margin-top: 10px; font-weight: 600; }
    .meta-item mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* BOTONES DE ACCIÓN PREMIUM */
    .card-actions-premium { padding: 15px 20px 20px; }

    .btn-atender-premium, .btn-continuar-premium {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 14px;
      font-weight: 950;
      font-size: 0.75rem;
      letter-spacing: 1.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      transition: 0.3s;
      text-transform: uppercase;
    }

    .btn-atender-premium {
      background: #f1f5f9;
      color: #475569;
    }
    .btn-atender-premium:hover { background: #e2e8f0; color: #1e293b; transform: scale(1.02); }

    .btn-continuar-premium {
      background: rgba(211, 84, 0, 0.1);
      color: var(--primary-color);
    }
    .btn-continuar-premium:hover { background: var(--primary-color); color: white; box-shadow: 0 10px 25px rgba(211, 84, 0, 0.3); }

    .btn-doc-final {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--secondary-color);
      border-radius: 14px;
      font-weight: 900;
      font-size: 0.7rem;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: 0.3s;
      background: transparent;
      color: var(--secondary-color);
      text-transform: uppercase;
    }
    .btn-doc-final:hover { 
      background: var(--secondary-color); 
      color: white; 
      box-shadow: 0 10px 20px rgba(59, 130, 246, 0.2);
      transform: scale(1.02);
    }
    .btn-doc-final mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `]
})
export class FuncionarioMonitorComponent implements OnInit, OnDestroy {
  misLanes: string[] = [];
  pendientes: any[] = [];
  enProceso: any[] = [];
  completadas: any[] = [];

  private rxStomp = new RxStomp();
  private subscriptions: Subscription[] = [];

  constructor(
    private bpmsService: BpmsService, 
    private dialog: MatDialog,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const email = this.authService.getEmail();
    this.bpmsService.getMiPerfil(email).subscribe(user => {
      // Cargamos todos los departamentos del usuario
      this.misLanes = [];
      if (user.laneId) this.misLanes.push(user.laneId);
      
      // Si tiene más departamentos, los buscamos por sus nombres normalizados
      this.bpmsService.listarDepartamentos().subscribe(allDepts => {
        const otros = allDepts
          .filter(d => user.departamentoIds?.includes(d.id))
          .map(d => d.nombreNormalizado);
        
        // Unimos y eliminamos duplicados
        this.misLanes = Array.from(new Set([...this.misLanes, ...otros]));
        
        this.cargarTareas();
        this.inicializarWebSocket();
        this.cdr.detectChanges();
      });
    });
  }

  cargarTareas() {
    if (this.misLanes.length === 0) return;
    this.bpmsService.getTareasPendientes(this.misLanes).subscribe(data => { this.pendientes = data; this.cdr.detectChanges(); });
    this.bpmsService.getTareasEnProceso(this.misLanes).subscribe(data => { this.enProceso = data; this.cdr.detectChanges(); });
    this.bpmsService.getTareasCompletadas(this.misLanes).subscribe(data => { this.completadas = data; this.cdr.detectChanges(); });
  }

  inicializarWebSocket() {
    this.rxStomp.configure({
      webSocketFactory: () => new SockJSClass('http://localhost:8080/ws-bpms'),
      reconnectDelay: 5000
    });
    this.rxStomp.activate();

    // Nos suscribimos a todos sus departamentos
    this.misLanes.forEach(lane => {
      const sub = this.rxStomp.watch(`/topic/tareas/${lane}`).subscribe(message => {
        const nuevaTarea = JSON.parse(message.body);
        this.pendientes = [nuevaTarea, ...this.pendientes.filter(t => t.id !== nuevaTarea.id)];
        
        // EFECTO DE SONIDO (Solo para el funcionario)
        this.reproducirAlerta();
        
        this.cdr.detectChanges();
      });
      this.subscriptions.push(sub);
    });
  }

  reproducirAlerta() {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play();
    } catch (e) {
      console.warn('No se pudo reproducir el sonido de alerta', e);
    }
  }

  abrirVentanilla() {
    const dialogRef = this.dialog.open(AtencionVentanillaComponent, {
      width: '850px',
      maxWidth: '95vw',
      height: '85vh',
      maxHeight: '90vh',
      panelClass: 'premium-modal-box'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.cargarTareas();
    });
  }

  atenderTarea(t: any) {
    // MARCAR COMO ATENDIDA EN EL BACKEND
    const userEmail = this.authService.getEmail();
    this.bpmsService.atenderTarea(t.id, userEmail).subscribe(() => {
      this.continuarTarea(t);
    });
  }

  activeTask: any = null;
  activeSchema: string = '[]';
  activeInstancia: any = null;
  isFinalDocMode: boolean = false;
  contextoParseado: any = {};

  continuarTarea(t: any) {
    this.isFinalDocMode = false;
    this.bpmsService.getInstanciaDetalle(t.instanciaProcesoId).subscribe(instancia => {
      this.bpmsService.generarFormulario(t.politicaNegocioId, t.taskDefinitionId).subscribe(schema => {
        this.activeTask = t;
        this.activeSchema = schema;
        this.activeInstancia = instancia;
        this.cdr.detectChanges();
      });
    });
  }

  redactarDocFinal(t: any) {
    this.isFinalDocMode = true;
    this.bpmsService.getInstanciaDetalle(t.instanciaProcesoId).subscribe(instancia => {
      this.activeTask = t;
      this.activeInstancia = instancia;
      try {
        this.contextoParseado = JSON.parse(instancia.contextoJson || '{}');
      } catch (e) {
        this.contextoParseado = {};
      }
      this.cdr.detectChanges();
    });
  }

  handleFormSubmission(resp: any) {
    if (!this.activeTask) return;
    this.bpmsService.completarTarea(this.activeTask.id, resp).subscribe(() => {
      this.activeTask = null;
      this.cargarTareas();
    });
  }

  handleDocSubmission() {
    this.activeTask = null;
    this.isFinalDocMode = false;
    this.cargarTareas();
  }

  cancelarAtencion() {
    this.activeTask = null;
    this.isFinalDocMode = false;
    this.cargarTareas();
  }

  calcularTiempo(f: any): string {
    if (!f) return '---';
    // Forzamos el parseo a Date (f puede venir como string ISO o Instant)
    const inicio = new Date(f).getTime();
    const ahora = new Date().getTime();
    const diffMs = ahora - inicio;
    
    // Si la diferencia es negativa o inválida (por desfase de reloj)
    if (diffMs < 0 || isNaN(diffMs)) return 'hace un momento';

    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.rxStomp.deactivate();
  }
}
