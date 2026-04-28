import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-portal-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div class="tracking-container animate-hero">
      
      <div class="tracking-card glass-panel">
        <header class="card-header">
          <button mat-icon-button routerLink="/portal" class="back-btn"><mat-icon>arrow_back</mat-icon></button>
          <div class="id-group">
            <span class="tag">TOKEN DE SEGUIMIENTO</span>
            <h3>{{ token }}</h3>
          </div>
          <div class="status-badge" [ngClass]="data?.estado">
            {{ data?.estado }}
          </div>
        </header>

        <div class="tracking-body" *ngIf="data">
          <!-- STEPPER VISUAL ESTILO PEDIDOS YA -->
          <div class="stepper-visual">
            <div class="step" *ngFor="let lane of lanesUnicos; let i = index" 
                 [ngClass]="{'active': lane === data.instancia.laneId, 'completed': isLaneCompleted(lane)}">
              <div class="step-orb">
                <mat-icon>{{ getIconForLane(lane) }}</mat-icon>
                <div class="connector" *ngIf="i < lanesUnicos.length - 1"></div>
              </div>
              <div class="step-label">
                <strong>{{ lane }}</strong>
                <span>{{ getStatusForLane(lane) }}</span>
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <mat-icon>person</mat-icon>
              <div>
                <small>Solicitante</small>
                <p>{{ data.instancia.solicitanteNombre || 'Anónimo' }}</p>
              </div>
            </div>
            <div class="info-item">
              <mat-icon>history</mat-icon>
              <div>
                <small>Estado Temporal</small>
                <p>Iniciado hace {{ calcularTiempo(data.instancia.fechaInicio) }}</p>
              </div>
            </div>
          </div>

          <div class="activity-log">
            <h4>Actividad Reciente</h4>
            <div class="log-item" *ngFor="let t of data.tareas">
              <div class="log-dot" [ngClass]="t.estado"></div>
              <div class="log-content">
                <strong>{{ t.nombre }}</strong>
                <p>En departamento: {{ t.laneId }}</p>
                <small>Recibido: {{ t.fechaInicio | date:'HH:mm:ss' }}</small>
              </div>
              <span class="log-status">{{ t.estado }}</span>
            </div>
          </div>
        </div>

        <div class="error-state" *ngIf="!data && !loading">
          <mat-icon>error_outline</mat-icon>
          <h3>Token no encontrado</h3>
          <p>Verifica que el código sea correcto.</p>
          <button mat-raised-button color="primary" routerLink="/portal">VOLVER AL CATÁLOGO</button>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
      </div>

    </div>
  `,
  styles: [`
    .tracking-container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .tracking-card { border-radius: 40px; overflow: hidden; border: 1px solid var(--glass-border); background: var(--surface); }
    
    .card-header { padding: 30px 40px; display: flex; align-items: center; gap: 20px; border-bottom: 1px solid var(--glass-border); }
    .back-btn { background: var(--bg-app); border-radius: 12px; }
    .id-group { flex: 1; }
    .tag { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; }
    .id-group h3 { margin: 0; color: var(--primary-color); font-weight: 800; }
    
    .status-badge { padding: 8px 20px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; }
    .status-badge.EN_CURSO { background: rgba(211, 84, 0, 0.1); color: var(--primary-color); }
    .status-badge.FINALIZADO { background: #27ae60; color: white; }

    .tracking-body { padding: 40px; }

    /* STEPPER STYLE */
    .stepper-visual { display: flex; justify-content: space-between; margin-bottom: 60px; padding: 0 20px; }
    .step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
    .step-orb { width: 50px; height: 50px; border-radius: 50%; background: var(--bg-app); border: 2px solid var(--glass-border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); z-index: 2; transition: 0.5s; }
    .connector { position: absolute; height: 3px; background: var(--glass-border); width: 100%; top: 25px; left: 50%; z-index: 1; }
    
    .step.active .step-orb { background: var(--primary-color); color: white; border-color: var(--primary-color); box-shadow: 0 0 20px rgba(211, 84, 0, 0.4); }
    .step.completed .step-orb { background: var(--secondary-color); color: white; }
    .step.completed .connector { background: var(--secondary-color); }

    .step-label { margin-top: 15px; text-align: center; display: flex; flex-direction: column; }
    .step-label strong { font-size: 0.85rem; color: var(--text-main); }
    .step-label span { font-size: 0.7rem; color: var(--text-muted); }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; background: var(--bg-app); padding: 25px; border-radius: 24px; }
    .info-item { display: flex; align-items: center; gap: 15px; }
    .info-item mat-icon { color: var(--primary-color); }
    .info-item small { color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 0.65rem; }
    .info-item p { margin: 0; font-weight: 800; color: var(--text-main); }

    .activity-log h4 { margin-bottom: 20px; color: var(--text-main); font-weight: 800; }
    .log-item { display: flex; align-items: center; gap: 20px; padding: 15px 0; border-bottom: 1px solid var(--glass-border); }
    .log-dot { width: 10px; height: 10px; border-radius: 50%; }
    .log-dot.COMPLETADA { background: #27ae60; }
    .log-dot.PENDIENTE { background: #f1c40f; }
    .log-content { flex: 1; }
    .log-content strong { font-size: 0.9rem; color: var(--text-main); }
    .log-content p { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
    .log-status { font-size: 0.7rem; font-weight: 800; color: var(--text-muted); }

    .error-state { padding: 60px; text-align: center; }
    .error-state mat-icon { font-size: 60px; width: 60px; height: 60px; color: #e74c3c; margin-bottom: 20px; }
  `]
})
export class PortalTrackingComponent implements OnInit {
  token: string = '';
  data: any;
  loading: boolean = true;
  lanesUnicos: string[] = [];

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.cargarSeguimiento();
  }

  cargarSeguimiento() {
    this.http.get<any>(`http://13.217.197.171:8080/api/public/seguimiento/${this.token}`).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        const lanes = res.tareas.map((t: any) => t.laneId);
        this.lanesUnicos = Array.from(new Set(lanes));
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  isLaneCompleted(lane: string) {
    return this.data.tareas.some((t: any) => t.laneId === lane && t.estado === 'COMPLETADA');
  }

  getStatusForLane(lane: string) {
    if (lane === this.data.instancia.laneId) return 'En proceso aquí';
    return this.isLaneCompleted(lane) ? 'Completado' : 'Pendiente';
  }

  getIconForLane(lane: string) {
    if (lane.toLowerCase().includes('tecnic')) return 'engineering';
    if (lane.toLowerCase().includes('atencion')) return 'support_agent';
    if (lane.toLowerCase().includes('comercial')) return 'payments';
    return 'business';
  }

  calcularTiempo(f: any): string {
    if (!f) return '---';
    const inicio = new Date(f).getTime();
    const ahora = new Date().getTime();
    const diffMs = ahora - inicio;
    if (diffMs < 0 || isNaN(diffMs)) return 'hace un momento';
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  }
}
