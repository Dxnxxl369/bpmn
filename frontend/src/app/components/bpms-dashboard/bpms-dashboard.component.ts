import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BpmsService, PoliticaNegocio } from '../../services/bpms.service';
import { BpmnEditorComponent } from '../bpmn-editor/bpmn-editor.component';
import { AnaliticasDashboardComponent } from '../analiticas-dashboard/analiticas-dashboard.component';

@Component({
  selector: 'app-bpms-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, 
    MatInputModule, MatTabsModule, MatProgressBarModule, MatChipsModule, MatTooltipModule, MatSnackBarModule,
    BpmnEditorComponent, AnaliticasDashboardComponent
  ],
  template: `
    <div class="dashboard-shell">
      
      <!-- BOTÓN FLOTANTE PARA ABRIR BIBLIOTECA (SOLO EN STUDIO) -->
      <button class="fab-library" *ngIf="politicaSeleccionada" (click)="showHistory = true" matTooltip="Ver otras políticas">
        <mat-icon>library_books</mat-icon>
      </button>

      <!-- SIDEBAR COMO DRAWER FLOTANTE (PUNTO 2) -->
      <div class="drawer-backdrop" *ngIf="showHistory" (click)="showHistory = false"></div>
      <aside class="sidebar-drawer" [class.drawer-open]="showHistory">
        <div class="drawer-header">
          <mat-icon>inventory_2</mat-icon>
          <span>Repositorio Digital</span>
          <button mat-icon-button (click)="showHistory = false"><mat-icon>close</mat-icon></button>
        </div>
        
        <div class="drawer-list">
          <div *ngFor="let p of politicas" 
               class="drawer-item" 
               [class.active-item]="politicaSeleccionada?.id === p.id"
               (click)="seleccionarPolitica(p)">
            <mat-icon>schema</mat-icon>
            <div class="item-info">
              <strong>{{ p.nombre }}</strong>
              <small>{{ p.fechaCreacion | date:'shortDate' }}</small>
            </div>
          </div>
        </div>
      </aside>

      <!-- ÁREA DE CONTENIDO (PUNTO 2: OCUPA TODO EL ANCHO) -->
      <main class="main-canvas">
        
        <!-- ESCENA 1: BIENVENIDA -->
        <section class="welcome-scene animate-hero" *ngIf="!politicaSeleccionada">
          <header class="hero-text">
            <div class="badge">IA ORCHESTRATOR v2.5</div>
            <h1>Modelado de Procesos <span>Inteligentes</span></h1>
            <p>Genera y orquesta flujos BPMN 2.0 con la potencia de Llama 3.</p>
          </header>

          <div class="action-grid">
            <div class="hero-card hero-card-glow" (click)="fileInput.click()">
              <div class="card-orb"><mat-icon>upload_file</mat-icon></div>
              <h3>Extraer de PDF</h3>
              <p>Sube tu manual de procesos.</p>
              <input type="file" #fileInput (change)="onFileSelected($event)" hidden accept="application/pdf">
              <div class="loader-line" *ngIf="procesandoPDF"></div>
            </div>

            <div class="hero-card hero-card-glow">
              <div class="card-orb"><mat-icon>auto_fix_high</mat-icon></div>
              <h3>Diseño Libre</h3>
              <textarea [(ngModel)]="textoManual" placeholder="Describe el proceso aquí..."></textarea>
              <button class="hero-action-btn" (click)="procesarTexto()" [disabled]="!textoManual || procesandoTexto">GENERAR FLUJO</button>
              <div class="loader-line" *ngIf="procesandoTexto"></div>
            </div>

            <div class="hero-card hero-card-glow" (click)="showHistory = true">
              <div class="card-orb archive-orb"><mat-icon>folder_special</mat-icon></div>
              <h3>Ver Repositorio</h3>
              <p>Explora tus {{ politicas.length }} políticas.</p>
              <button class="hero-action-btn secondary-btn">ABRIR ARCHIVO</button>
            </div>
          </div>
        </section>

        <!-- ESCENA 2: STUDIO (PUNTO 3: BOTÓN LANZAR PROMINENTE) -->
        <div class="studio-scene" *ngIf="politicaSeleccionada">
          <div class="studio-header glass-panel">
            <button mat-icon-button (click)="cerrarEditor()" class="back-btn" matTooltip="Volver al Inicio">
              <mat-icon>arrow_back</mat-icon>
            </button>
            
            <div class="studio-title-group">
              <span class="studio-tag">DISEÑO ACTIVO</span>
              <div class="studio-title">{{ politicaSeleccionada.nombre }}</div>
            </div>
            
            <div class="spacer"></div>
            
            <!-- BOTÓN LANZAR (EL PLAY QUE BUSCABAS) -->
            <button class="btn-rocket-launch animate-pulse" (click)="lanzarInstancia()">
              <mat-icon>rocket_launch</mat-icon>
              <span>PUBLICAR Y LANZAR</span>
            </button>
          </div>

          <div class="studio-body">
            <mat-tab-group class="modern-tabs">
              <mat-tab>
                <ng-template mat-tab-label><mat-icon>architecture</mat-icon> Designer Studio</ng-template>
                <app-bpmn-editor [politica]="politicaSeleccionada"></app-bpmn-editor>
              </mat-tab>
              <mat-tab>
                <ng-template mat-tab-label><mat-icon>insights</mat-icon> Centro de Analíticas</ng-template>
                <app-analiticas-dashboard [politicaId]="politicaSeleccionada.id!"></app-analiticas-dashboard>
              </mat-tab>
            </mat-tab-group>
          </div>
        </div>
      </main>

    </div>
  `,
  styles: [`
    .dashboard-shell { display: flex; min-height: 100vh; background: var(--bg-app); position: relative; overflow: hidden; }

    /* FAB LIBRARY */
    .fab-library {
      position: fixed; left: 20px; top: 90px; width: 56px; height: 56px; border-radius: 16px;
      background: var(--surface); color: var(--primary-color); border: 2px solid var(--primary-color);
      display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 500;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: 0.3s;
    }
    .fab-library:hover { transform: scale(1.1); background: var(--primary-color); color: white; }

    /* SIDEBAR DRAWER (Oculto por defecto - Punto 2) */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 2000; }
    .sidebar-drawer {
      position: fixed; top: 0; left: -450px; width: 400px; height: 100vh;
      background: var(--surface); z-index: 2100;
      transition: var(--transition-smooth); padding: 40px;
    }
    .drawer-open { left: 0; box-shadow: 20px 0 50px rgba(0,0,0,0.2); }
    .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; color: var(--primary-color); font-weight: 800; font-size: 1.2rem; }
    
    .drawer-list { overflow-y: auto; max-height: calc(100vh - 150px); }
    .drawer-item { 
      display: flex; align-items: center; gap: 15px; padding: 18px; border-radius: 16px; 
      cursor: pointer; transition: 0.2s; background: rgba(0,0,0,0.02); margin-bottom: 10px;
    }
    .drawer-item:hover { background: var(--primary-color); color: white; transform: translateX(10px); }
    .active-item { border: 2px solid var(--primary-color); background: rgba(211, 84, 0, 0.05); }
    .item-info { display: flex; flex-direction: column; }
    .item-info small { opacity: 0.6; font-size: 0.7rem; }

    /* CONTENIDO PRINCIPAL */
    .main-canvas { flex: 1; position: relative; width: 100%; z-index: 1; }

    .welcome-scene { padding: 80px 40px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .hero-text { margin-bottom: 60px; }
    .badge { display: inline-block; background: rgba(211, 84, 0, 0.1); color: var(--primary-color); padding: 5px 20px; border-radius: 20px; font-weight: 800; font-size: 0.7rem; letter-spacing: 2px; }
    h1 { font-size: 4rem; font-weight: 900; margin: 15px 0; color: var(--text-main); }
    h1 span { color: var(--primary-color); }
    .action-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; width: 100%; max-width: 1300px; }

    .hero-card { background: var(--surface); padding: 40px; border-radius: 32px; display: flex; flex-direction: column; align-items: center; border: 1px solid var(--glass-border); }
    .card-orb { width: 64px; height: 64px; background: rgba(0,0,0,0.03); color: var(--secondary-color); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 25px; transition: 0.3s; }
    .archive-orb { color: var(--primary-color); }
    .hero-card:hover .card-orb { background: var(--primary-color); color: white; transform: scale(1.1); }

    textarea { width: 100%; height: 100px; border: 1px solid rgba(0,0,0,0.1); border-radius: 16px; padding: 15px; margin-bottom: 20px; outline: none; background: rgba(0,0,0,0.02); color: var(--text-main); font-family: inherit; }
    .hero-action-btn { width: 100%; background: var(--primary-color); color: white; border: none; padding: 15px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: 0.2s; }
    .secondary-btn { background: var(--secondary-color); }

    /* STUDIO SCENE */
    .studio-scene { display: flex; flex-direction: column; height: 100vh; background: var(--bg-app); }
    .studio-header { height: 80px; display: flex; align-items: center; padding: 0 40px; gap: 20px; border-bottom: 1px solid var(--glass-border); background: var(--surface); }
    .back-btn { background: rgba(0,0,0,0.03); color: var(--text-main); border-radius: 12px; }
    .studio-title-group { display: flex; flex-direction: column; }
    .studio-tag { font-size: 0.6rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; }
    .studio-title { font-weight: 800; color: var(--primary-color); font-size: 1.3rem; }

    /* BOTÓN ROCKET LAUNCH (PUNTO 3) */
    .btn-rocket-launch {
      background: linear-gradient(135deg, #d35400, #e67e22); color: white; border: none;
      padding: 12px 30px; border-radius: 16px; font-weight: 800; display: flex; align-items: center; gap: 10px;
      cursor: pointer; box-shadow: 0 8px 20px rgba(211, 84, 0, 0.3); transition: 0.3s;
    }
    .btn-rocket-launch:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 12px 25px rgba(211, 84, 0, 0.4); }
    .animate-pulse { animation: pulse-shadow 2s infinite; }
    @keyframes pulse-shadow { 0% { box-shadow: 0 0 0 0 rgba(211, 84, 0, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(211, 84, 0, 0); } 100% { box-shadow: 0 0 0 0 rgba(211, 84, 0, 0); } }

    .studio-body { flex: 1; overflow: hidden; }
    ::ng-deep .pro-tabs { height: 100%; display: flex; flex-direction: column; }
    ::ng-deep .pro-tabs .mat-mdc-tab-body-wrapper { flex: 1; }
    .spacer { flex: 1; }

    .loader-line { position: absolute; bottom: 0; left: 0; height: 4px; background: var(--primary-color); width: 100%; animation: beam 1.5s infinite; }
    @keyframes beam { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  `]
})
export class BpmsDashboardComponent implements OnInit {
  textoManual: string = '';
  procesandoPDF: boolean = false;
  procesandoTexto: boolean = false;
  showHistory: boolean = false;
  politicas: PoliticaNegocio[] = [];
  politicaSeleccionada?: PoliticaNegocio;

  constructor(private bpmsService: BpmsService, private snackBar: MatSnackBar) {}

  ngOnInit() { this.cargarPoliticas(); }

  cargarPoliticas() {
    this.bpmsService.listarPoliticas().subscribe(data => this.politicas = data);
  }

  seleccionarPolitica(p: PoliticaNegocio) {
    this.politicaSeleccionada = p;
    this.showHistory = false;
  }

  cerrarEditor() {
    this.politicaSeleccionada = undefined;
    this.showHistory = false;
  }

  lanzarInstancia() {
    // FASE 3: El Admin ya no pone el nombre del cliente, solo PUBLICA el diagrama para que esté listo.
    this.bpmsService.iniciarInstancia(this.politicaSeleccionada!.id!, this.politicaSeleccionada!.xmlBpmn, 'SISTEMA').subscribe({
      next: () => this.snackBar.open('🚀 ¡PROCESO PUBLICADO! Ahora es visible para los ejecutivos.', 'GENIAL', { duration: 4000 }),
      error: (err) => {
        console.error(err);
        alert('Error al publicar proceso. Revisa la consola del backend.');
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.procesandoPDF = true;
      this.bpmsService.procesarDocumento(file).subscribe({
        next: (res) => {
          this.politicas = [...res, ...this.politicas];
          this.procesandoPDF = false;
          if (res.length > 0) this.seleccionarPolitica(res[0]);
        },
        error: () => this.procesandoPDF = false
      });
    }
  }

  procesarTexto() {
    this.procesandoTexto = true;
    this.bpmsService.procesarTextoManual(this.textoManual).subscribe({
      next: (res) => {
        this.politicas = [...res, ...this.politicas];
        this.textoManual = '';
        this.procesandoTexto = false;
        if (res.length > 0) this.seleccionarPolitica(res[0]);
      },
      error: () => this.procesandoTexto = false
    });
  }
}
