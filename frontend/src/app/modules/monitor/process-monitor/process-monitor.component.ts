import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { BpmsService, PoliticaNegocio } from '../../../services/bpms.service';

@Component({
  selector: 'app-process-monitor',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="monitor-container">
      <header class="page-header">
        <h1>Monitor de <span>Orquestación</span></h1>
        <p>Vista general de la plataforma y el estado de todos los procesos vivos.</p>
      </header>

      <div class="stats-grid">
        <mat-card class="stat-card glass-panel">
          <div class="stat-icon"><mat-icon>account_tree</mat-icon></div>
          <div class="stat-info">
            <h2>{{ politicas.length }}</h2>
            <p>Políticas Registradas</p>
          </div>
        </mat-card>

        <mat-card class="stat-card glass-panel">
          <div class="stat-icon"><mat-icon>speed</mat-icon></div>
          <div class="stat-info">
            <h2>{{ instanciasActivas }}</h2>
            <p>Trámites en Curso</p>
          </div>
        </mat-card>
      </div>

      <div class="empty-state">
        <mat-icon>construction</mat-icon>
        <p>El mapa interactivo de procesos activos está en construcción.</p>
      </div>
    </div>
  `,
  styles: [`
    .monitor-container { padding: 40px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 40px; text-align: center; }
    h1 { font-size: 2.5rem; font-weight: 900; margin: 0; color: var(--text-main); }
    h1 span { color: var(--primary-color); }
    p { color: var(--text-muted); }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 40px; }
    .stat-card { display: flex; flex-direction: row; align-items: center; padding: 20px; border-radius: 20px; border: 1px solid var(--glass-border); background: var(--surface); }
    .stat-icon { width: 60px; height: 60px; background: rgba(211, 84, 0, 0.1); color: var(--primary-color); border-radius: 15px; display: flex; align-items: center; justify-content: center; margin-right: 20px; }
    .stat-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .stat-info h2 { margin: 0; font-size: 2rem; color: var(--text-main); font-weight: 800; }
    .stat-info p { margin: 0; color: var(--text-muted); font-size: 0.9rem; }

    .empty-state { text-align: center; color: var(--text-muted); margin-top: 50px; opacity: 0.7; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 15px; }
  `]
})
export class ProcessMonitorComponent implements OnInit {
  politicas: PoliticaNegocio[] = [];
  instanciasActivas: number = 0; // Se conectará al backend pronto

  constructor(private bpmsService: BpmsService) {}

  ngOnInit() {
    this.bpmsService.listarPoliticas().subscribe(data => this.politicas = data);
    // TODO: Llamar al backend para listar instancias en curso
  }
}
