import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { BpmsService, PoliticaNegocio } from '../../services/bpms.service';

@Component({
  selector: 'app-macro-proceso-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatSelectModule, MatSnackBarModule],
  template: `
    <div class="macro-shell animate-fade-up">
      
      <header class="hero-header">
        <div class="badge-pro">ORQUESTACIÓN AVANZADA</div>
        <h1>Diseño de <span>Macro-Flujos</span></h1>
        <p>Conecta procesos individuales para crear cadenas de valor End-to-End en tu organización.</p>
      </header>

      <div class="main-content">
        
        <!-- CONSTRUCTOR DE FLUJO -->
        <div class="builder-column">
          <div class="glass-panel p-30">
            <h2 class="section-title"><mat-icon>architecture</mat-icon> Nuevo Macro-Proceso</h2>
            
            <div class="input-group mt-20">
              <label>Nombre de la Cadena de Valor</label>
              <input type="text" class="custom-input" [(ngModel)]="nombre" placeholder="Ej: Ciclo completo de vida del empleado">
            </div>

            <div class="input-group mt-20">
              <label>Añadir Fase al Flujo</label>
              <div class="add-row">
                <div class="custom-select-wrapper">
                  <select class="custom-select" [(ngModel)]="politicaSeleccionada">
                    <option [ngValue]="undefined" disabled selected>Selecciona un trámite base...</option>
                    <option *ngFor="let p of politicas" [ngValue]="p">{{ p.nombre }}</option>
                  </select>
                  <mat-icon class="select-icon">expand_more</mat-icon>
                </div>
                <button class="btn-add" (click)="agregarPaso()" [disabled]="!politicaSeleccionada">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
            </div>

            <!-- TIMELINE VISUAL -->
            <div class="timeline-container mt-30" *ngIf="pasos.length > 0">
              <div class="timeline-line"></div>
              
              <div *ngFor="let p of pasos; let i = index" class="timeline-node animate-fade-up" [style.animation-delay]="i * 0.1 + 's'">
                <div class="node-marker">{{ i + 1 }}</div>
                <div class="node-card shadow-sm">
                  <div class="node-info">
                    <strong>{{ p.nombre }}</strong>
                    <span>Fase de ejecución</span>
                  </div>
                  <button class="btn-icon-danger" (click)="quitarPaso(i)" title="Remover paso"><mat-icon>close</mat-icon></button>
                </div>
              </div>
            </div>

            <div class="empty-timeline" *ngIf="pasos.length === 0">
              <div class="dashed-box">
                <mat-icon>linear_scale</mat-icon>
                <p>El flujo está vacío. Añade trámites para conectarlos.</p>
              </div>
            </div>

            <button class="btn-hero mt-30" (click)="guardar()" [disabled]="!nombre || pasos.length === 0">
              <mat-icon>rocket_launch</mat-icon> EMPAQUETAR MACRO-PROCESO
            </button>
          </div>
        </div>

        <!-- BIBLIOTECA DE MACRO-PROCESOS -->
        <div class="library-column">
          <div class="glass-panel p-30 h-100">
            <h2 class="section-title"><mat-icon>inventory_2</mat-icon> Cadenas Activas</h2>
            
            <div class="macro-list mt-20">
              <div *ngFor="let mp of macroProcesos" class="macro-card shadow-sm transition-hover">
                <div class="mc-icon"><mat-icon>hub</mat-icon></div>
                <div class="mc-details">
                  <h4>{{ mp.nombre }}</h4>
                  <span class="badge-fases">{{ mp.pasos?.length || 0 }} Fases configuradas</span>
                </div>
                <button class="btn-launch" (click)="iniciar(mp)" title="Iniciar Ejecución">
                  <mat-icon>play_arrow</mat-icon>
                </button>
              </div>

              <div class="empty-state-list" *ngIf="macroProcesos.length === 0">
                <mat-icon>auto_mode</mat-icon>
                <p>No hay macro-flujos registrados.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .macro-shell { padding: 20px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 30px; }
    
    .hero-header { text-align: center; margin-bottom: 20px; }
    .badge-pro { display: inline-block; background: rgba(44, 62, 80, 0.1); color: var(--secondary-color); padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; letter-spacing: 2px; margin-bottom: 15px; }
    .hero-header h1 { font-size: 3rem; font-weight: 900; color: var(--text-main); margin: 0 0 10px 0; letter-spacing: -1px; }
    .hero-header h1 span { color: var(--primary-color); }
    .hero-header p { font-size: 1.1rem; color: var(--text-muted); max-width: 600px; margin: 0 auto; }

    .main-content { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: start; }

    .p-30 { padding: 35px; border-radius: var(--border-radius-xl) !important; }
    .h-100 { height: 100%; box-sizing: border-box; }
    .mt-20 { margin-top: 20px; }
    .mt-30 { margin-top: 30px; }

    .section-title { display: flex; align-items: center; gap: 10px; font-size: 1.4rem; font-weight: 800; color: var(--secondary-color); margin: 0; }
    .section-title mat-icon { color: var(--primary-color); }

    /* Inputs Customizados */
    .input-group { display: flex; flex-direction: column; gap: 8px; }
    .input-group label { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .custom-input { 
      background: rgba(0,0,0,0.02); border: 1px solid var(--glass-border); padding: 15px 20px; 
      border-radius: 16px; font-family: inherit; font-size: 1rem; color: var(--text-main);
      transition: var(--transition-smooth); outline: none; width: 100%; box-sizing: border-box;
    }
    .custom-input:focus { background: white; border-color: var(--primary-color); box-shadow: 0 0 0 4px rgba(211,84,0,0.1); }
    body.dark-mode .custom-input { background: rgba(255,255,255,0.05); color: white; border-color: rgba(255,255,255,0.1); }
    body.dark-mode .custom-input:focus { background: #1e2128; }

    .add-row { display: flex; gap: 15px; }
    .custom-select-wrapper { position: relative; flex: 1; }
    .custom-select {
      width: 100%; appearance: none; background: rgba(0,0,0,0.02); border: 1px solid var(--glass-border);
      padding: 15px 20px; border-radius: 16px; font-family: inherit; font-size: 1rem; color: var(--text-main);
      cursor: pointer; outline: none; transition: var(--transition-smooth);
    }
    .custom-select:focus { background: white; border-color: var(--primary-color); }
    .select-icon { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); }
    body.dark-mode .custom-select { background: rgba(255,255,255,0.05); color: white; border-color: rgba(255,255,255,0.1); }
    body.dark-mode .custom-select option { background: #1e2128; color: white; }

    .btn-add {
      background: var(--secondary-color); color: white; border: none; width: 54px; height: 54px;
      border-radius: 16px; display: flex; justify-content: center; align-items: center;
      cursor: pointer; transition: var(--transition-fast); box-shadow: var(--shadow-sm);
    }
    .btn-add:hover:not(:disabled) { transform: scale(1.05) rotate(90deg); background: var(--primary-color); }
    .btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Timeline */
    .timeline-container { position: relative; padding-left: 20px; display: flex; flex-direction: column; gap: 20px; }
    .timeline-line { position: absolute; left: 34px; top: 0; bottom: 0; width: 3px; background: linear-gradient(to bottom, var(--primary-color) 0%, rgba(211,84,0,0.1) 100%); border-radius: 3px; }
    
    .timeline-node { display: flex; align-items: center; gap: 25px; position: relative; z-index: 2; }
    .node-marker {
      width: 32px; height: 32px; background: white; border: 3px solid var(--primary-color); color: var(--primary-color);
      border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: 800; font-size: 0.9rem;
      box-shadow: 0 0 0 5px var(--bg-app);
    }
    body.dark-mode .node-marker { background: #1e2128; box-shadow: 0 0 0 5px #0f1115; }
    .node-card {
      flex: 1; background: white; border-radius: 16px; padding: 15px 20px;
      display: flex; justify-content: space-between; align-items: center;
      border: 1px solid var(--glass-border); transition: var(--transition-fast);
    }
    .node-card:hover { transform: translateX(5px); border-color: var(--primary-color); }
    body.dark-mode .node-card { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); }
    
    .node-info { display: flex; flex-direction: column; }
    .node-info strong { font-size: 1.05rem; color: var(--text-main); font-weight: 700; }
    .node-info span { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-top: 4px;}

    .btn-icon-danger { background: transparent; border: none; color: #ff7675; cursor: pointer; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
    .btn-icon-danger:hover { background: rgba(255, 118, 117, 0.1); color: #d63031; transform: rotate(90deg); }

    .empty-timeline { padding: 20px 0; }
    .dashed-box { border: 2px dashed rgba(0,0,0,0.1); border-radius: 16px; padding: 30px; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 10px; }
    body.dark-mode .dashed-box { border-color: rgba(255,255,255,0.1); }

    .btn-hero {
      width: 100%; background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
      color: white; border: none; padding: 20px; border-radius: 16px; font-size: 1rem; font-weight: 800; letter-spacing: 1px;
      cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px;
      transition: var(--transition-smooth); box-shadow: 0 10px 20px rgba(211,84,0,0.3);
    }
    .btn-hero:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(211,84,0,0.4); }
    .btn-hero:disabled { background: #bdc3c7; box-shadow: none; cursor: not-allowed; }
    body.dark-mode .btn-hero:disabled { background: #2f3542; color: #747d8c; }

    /* Library Column */
    .macro-list { display: flex; flex-direction: column; gap: 15px; overflow-y: auto; max-height: 600px; padding-right: 10px; }
    .macro-card {
      background: white; border-radius: 16px; padding: 20px; border: 1px solid var(--glass-border);
      display: flex; align-items: center; gap: 20px; cursor: pointer; transition: var(--transition-smooth);
    }
    .macro-card:hover { transform: translateY(-4px); border-color: var(--primary-color); box-shadow: var(--shadow-md); }
    body.dark-mode .macro-card { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); }
    body.dark-mode .macro-card:hover { border-color: var(--primary-color); }

    .mc-icon { width: 48px; height: 48px; background: rgba(44, 62, 80, 0.05); color: var(--secondary-color); border-radius: 14px; display: flex; justify-content: center; align-items: center; transition: 0.3s; }
    .macro-card:hover .mc-icon { background: var(--primary-color); color: white; }
    body.dark-mode .mc-icon { background: rgba(255,255,255,0.05); color: var(--text-muted); }
    body.dark-mode .macro-card:hover .mc-icon { background: var(--primary-color); color: white; }

    .mc-details { flex: 1; display: flex; flex-direction: column; gap: 5px; }
    .mc-details h4 { margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
    .badge-fases { align-self: flex-start; font-size: 0.7rem; background: rgba(0,0,0,0.05); color: var(--text-muted); padding: 4px 10px; border-radius: 10px; font-weight: 600; text-transform: uppercase; }
    body.dark-mode .badge-fases { background: rgba(255,255,255,0.05); }

    .btn-launch {
      width: 44px; height: 44px; border-radius: 50%; border: none; background: rgba(46, 204, 113, 0.1); color: #2ecc71;
      display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;
    }
    .btn-launch:hover { background: #2ecc71; color: white; transform: scale(1.1); box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3); }

    .empty-state-list { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; color: var(--text-muted); text-align: center; gap: 15px; }
    .empty-state-list mat-icon { font-size: 64px; width: 64px; height: 64px; opacity: 0.2; }
  `]
})
export class MacroProcesoEditorComponent implements OnInit {
  nombre: string = '';
  politicas: PoliticaNegocio[] = [];
  pasos: PoliticaNegocio[] = [];
  macroProcesos: any[] = [];
  politicaSeleccionada?: PoliticaNegocio;

  private apiUrl = 'http://13.217.197.171:8080/api/macroprocesos';

  constructor(
    private bpmsService: BpmsService, 
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void { this.cargarDatos(); }

  cargarDatos() {
    this.bpmsService.listarPoliticas().subscribe(data => this.politicas = data);
    this.http.get<any[]>(this.apiUrl).subscribe(data => this.macroProcesos = data);
  }

  agregarPaso() {
    if (this.politicaSeleccionada) {
      this.pasos.push(this.politicaSeleccionada);
      this.politicaSeleccionada = undefined;
    }
  }

  quitarPaso(index: number) { this.pasos.splice(index, 1); }

  guardar() {
    if (!this.nombre || this.pasos.length === 0) return;
    this.http.post<any>(this.apiUrl, { nombre: this.nombre }).subscribe(mp => {
      this.pasos.forEach((p, index) => {
        this.http.post(`${this.apiUrl}/${mp.id}/pasos`, {
          politicaNegocioId: p.id,
          posicion: index + 1
        }).subscribe();
      });
      this.snackBar.open('Macro-flujo orquestado exitosamente', 'OK', { duration: 3000 });
      this.cargarDatos();
      this.pasos = [];
      this.nombre = '';
    });
  }

  iniciar(mp: any) {
    const solicitante = prompt('Nombre del solicitante para este Macro-Proceso:');
    if (!solicitante) return;
    this.http.post(`${this.apiUrl}/${mp.id}/iniciar`, { solicitante }).subscribe(() => {
      this.snackBar.open('Macro-Proceso iniciado. Tareas enviadas a los funcionarios.', 'Cerrar');
    });
  }
}
