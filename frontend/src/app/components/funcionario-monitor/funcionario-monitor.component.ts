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
import { AuthService } from '../../services/auth.service';
import * as SockJSModule from 'sockjs-client';
const SockJSClass = (SockJSModule as any).default || SockJSModule;

@Component({
  selector: 'app-funcionario-monitor',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="monitor-shell animate-fade-up">
      <header class="monitor-header">
        <div class="header-top-row">
          <div class="pill">Área Operativa</div>
          <button mat-raised-button class="btn-ventanilla" (click)="abrirVentanilla()">
             <mat-icon>store</mat-icon> ATENCIÓN EN VENTANILLA
          </button>
        </div>
        <h1>Monitor de <span>Gestión</span></h1>
        <p>Departamentos: <strong>{{ misLanes.join(', ') }}</strong></p>
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
            <div class="task-scroller">
              <mat-card *ngFor="let t of pendientes" class="modern-task-card p-border">
                <mat-card-header>
                  <mat-card-title>{{ t.nodoNombre }}</mat-card-title>
                  <mat-card-subtitle>ID: #{{ t.id.substring(0,8) }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="meta-item"><mat-icon>person</mat-icon> {{ t.solicitanteNombre || 'Anónimo' }}</div>
                  <div class="meta-item"><mat-icon>schedule</mat-icon> Enviado: {{ t.fechaInicio | date:'HH:mm:ss' }}</div>
                </mat-card-content>
                <mat-card-actions>
                  <button class="btn-atender" (click)='atenderTarea(t)'>
                    ATENDER <mat-icon>play_circle</mat-icon>
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>

          <!-- EN PROCESO -->
          <div class="status-column">
            <div class="column-head c-proceso">
              <mat-icon>sync</mat-icon>
              <span>En Atención ({{ enProceso.length }})</span>
            </div>
            <div class="task-scroller">
              <mat-card *ngFor="let t of enProceso" class="modern-task-card w-border">
                <mat-card-header>
                  <mat-card-title>{{ t.nodoNombre }}</mat-card-title>
                  <mat-card-subtitle>ID: #{{ t.id.substring(0,8) }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="meta-item"><mat-icon>person</mat-icon> {{ t.solicitanteNombre || 'Anónimo' }}</div>
                  <div class="meta-item"><mat-icon>update</mat-icon> Atendiendo desde hace {{ calcularTiempo(t.fechaAtencion || t.fechaInicio) }}</div>
                </mat-card-content>
                <mat-card-actions>
                  <button class="btn-continuar" (click)='continuarTarea(t)'>
                    CONTINUAR <mat-icon>arrow_forward</mat-icon>
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>

          <!-- COMPLETADAS -->
          <div class="status-column">
            <div class="column-head c-fin">
              <mat-icon>check_circle</mat-icon>
              <span>Finalizadas ({{ completadas.length }})</span>
            </div>
            <div class="task-scroller">
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
      padding: 20px 40px; 
      background: var(--bg-app); 
      height: 100vh; 
      display: flex; 
      flex-direction: column; 
      overflow: hidden; /* Evita scroll en todo el body */
    }
    .monitor-header { text-align: center; margin-bottom: 20px; flex-shrink: 0; }
    
    /* VIEWPORT CON SCROLL HORIZONTAL */
    .monitor-viewport {
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      display: flex;
      padding-bottom: 10px;
    }

    .columns-grid { 
      display: grid; 
      grid-template-columns: repeat(3, minmax(380px, 1fr)); 
      gap: 25px; 
      min-width: 1200px;
      height: 100%; /* Ocupa todo el viewport */
    }

    .status-column { 
      background: rgba(0,0,0,0.02); 
      border-radius: 24px; 
      padding: 20px; 
      border: 1px solid var(--glass-border); 
      display: flex; 
      flex-direction: column; 
      height: 100%; /* Altura fija para habilitar scroll interno */
      max-height: calc(100vh - 250px); /* Ajuste según header */
    }
    body.dark-mode .status-column { background: rgba(255,255,255,0.02); }

    /* SCROLL VERTICAL PARA LAS TAREAS */
    .task-scroller { 
      flex: 1; 
      overflow-y: auto; 
      display: flex; 
      flex-direction: column; 
      gap: 12px; 
      padding-right: 8px;
    }
    
    /* Estilizar barra de scroll interna */
    .task-scroller::-webkit-scrollbar { width: 6px; }
    .task-scroller::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    body.dark-mode .task-scroller::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }

    .monitor-header h1 { font-size: 2.2rem; font-weight: 800; color: var(--text-main); margin: 5px 0; }
    .monitor-header h1 span { color: #d35400; } /* Naranja Gestión */
    .header-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .pill { display: inline-block; background: rgba(0,0,0,0.05); padding: 5px 15px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; color: var(--text-muted); }

    /* BOTÓN VENTANILLA NARANJA */
    .btn-ventanilla { background: #d35400 !important; color: white !important; font-weight: 800 !important; border-radius: 12px !important; padding: 0 20px !important; }

    /* COLORES DE CABECERAS */
    .column-head { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
    .c-pendientes { color: var(--text-muted); }
    .c-proceso { color: #d35400; } /* Naranja Atención */
    .c-fin { color: #27ae60; } /* Verde Finalizadas */

    .modern-task-card {
      background: var(--surface) !important;
      border-radius: 16px !important;
      border: 1px solid var(--glass-border) !important;
      transition: 0.3s;
    }
    .modern-task-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md) !important; }
    
    .p-border { border-left: 5px solid var(--text-muted) !important; }
    .w-border { border-left: 5px solid #d35400 !important; }
    .g-border { border-left: 5px solid #27ae60 !important; }

    .meta-item { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-muted); margin: 8px 0; }
    .meta-item mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .btn-atender {
      width: 100%; background: #d35400; color: white; border: none; padding: 12px;
      border-radius: 10px; font-weight: 800; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-atender:hover { filter: brightness(1.2); }

    .btn-continuar {
      width: 100%; background: #2c3e50; color: white; border: none; padding: 12px;
      border-radius: 10px; font-weight: 800; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-continuar:hover { background: #34495e; }
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
      webSocketFactory: () => new SockJSClass('http://13.217.197.171:8080/ws-bpms'),
      reconnectDelay: 5000
    });
    this.rxStomp.activate();

    // Nos suscribimos a todos sus departamentos
    this.misLanes.forEach(lane => {
      const sub = this.rxStomp.watch(`/topic/tareas/${lane}`).subscribe(message => {
        const nuevaTarea = JSON.parse(message.body);
        this.pendientes = [nuevaTarea, ...this.pendientes.filter(t => t.id !== nuevaTarea.id)];
        this.cdr.detectChanges();
      });
      this.subscriptions.push(sub);
    });
  }

  abrirVentanilla() {
    const dialogRef = this.dialog.open(AtencionVentanillaComponent, {
      width: '1200px',
      maxWidth: '95vw',
      panelClass: 'ventanilla-dialog'
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

  continuarTarea(t: any) {
    // 1. Obtener detalles de la instancia (Token y Contexto)
    this.bpmsService.getInstanciaDetalle(t.instanciaProcesoId).subscribe(instancia => {
      // 2. Traer el diseño del formulario
      this.bpmsService.generarFormulario(t.politicaNegocioId, t.taskDefinitionId).subscribe(schema => {
        
        const dialogRef = this.dialog.open(FormularioDinamicoComponent, { 
          width: 'auto', 
          maxWidth: 'none',
          data: { 
            schema: schema,
            instancia: instancia,
            isDialog: true 
          }
        });
        
        dialogRef.componentInstance.submitted.subscribe(resp => {
          this.bpmsService.completarTarea(t.id, resp).subscribe(() => {
            dialogRef.close();
            this.cargarTareas();
          });
        });
      });
    });
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
