import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-portal-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="portal-layout" [class.dark-mode-portal]="isDarkMode">
      <!-- HEADER PÚBLICO -->
      <header class="portal-header glass-panel">
        <div class="header-container">
          <div class="logo-group" routerLink="/portal">
            <mat-icon class="logo-icon">account_balance</mat-icon>
            <div class="logo-text">
              <h1 [style.color]="isDarkMode ? 'white' : '#1e293b'">CIUDADANO <span>DIGITAL</span></h1>
              <p>Cooperativa de Servicios Públicos</p>
            </div>
          </div>
          
          <div class="spacer"></div>

          <div class="actions">
            <!-- BOTÓN DE MODO OSCURO -->
            <button mat-icon-button (click)="toggleTheme()" [matTooltip]="isDarkMode ? 'Modo Claro' : 'Modo Oscuro'" class="theme-btn">
              <mat-icon>{{ isDarkMode ? 'light_mode' : 'dark_mode' }}</mat-icon>
            </button>

            <button mat-stroked-button routerLink="/login" class="admin-access">
              <mat-icon>admin_panel_settings</mat-icon> Acceso Admin
            </button>
          </div>
        </div>
      </header>

      <!-- ÁREA DE CONTENIDO -->
      <main class="portal-main">
        <router-outlet></router-outlet>
      </main>

      <footer class="portal-footer">
        <p [style.color]="isDarkMode ? '#94a3b8' : '#64748b'">© 2026 UAGRM - Innovación en Gestión de Trámites</p>
      </footer>
    </div>
  `,
  styles: [`
    .portal-layout { display: flex; flex-direction: column; min-height: 100vh; background: #fdfdfd; transition: background 0.4s; }
    .portal-layout.dark-mode-portal { background: #050505; }

    .portal-header { 
      background: rgba(255, 255, 255, 0.8) !important; 
      border-radius: 0; border: none !important; border-bottom: 1px solid rgba(0,0,0,0.05) !important; 
      height: 90px; display: flex; align-items: center; position: sticky; top: 0; z-index: 100;
    }
    .dark-mode-portal .portal-header { 
      background: rgba(15, 15, 15, 0.8) !important; 
      border-bottom: 1px solid rgba(255,255,255,0.05) !important; 
    }

    .header-container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 40px; display: flex; align-items: center; }
    .logo-group { display: flex; align-items: center; gap: 15px; cursor: pointer; }
    .logo-icon { font-size: 35px; width: 35px; height: 35px; color: var(--primary-color); }
    .logo-text h1 { margin: 0; font-size: 1.4rem; font-weight: 900; letter-spacing: -0.5px; }
    .logo-text h1 span { color: var(--primary-color); }
    .logo-text p { margin: 0; font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; }

    .actions { display: flex; align-items: center; gap: 15px; }
    .theme-btn { color: var(--text-muted); }
    .dark-mode-portal .theme-btn { color: #f1c40f; }

    .admin-access { 
      border-radius: 12px; font-weight: 700; 
      border-color: #1e293b !important; color: #1e293b !important; 
    }
    .dark-mode-portal .admin-access { border-color: white !important; color: white !important; }
    .admin-access:hover { background: var(--primary-color) !important; color: white !important; border-color: var(--primary-color) !important; }

    .portal-main { flex: 1; }
    .portal-footer { text-align: center; padding: 30px; border-top: 1px solid rgba(0,0,0,0.05); font-size: 0.85rem; font-weight: 600; }
    .spacer { flex: 1; }
  `]
})
export class PortalShellComponent implements OnInit {
  isDarkMode = false;

  ngOnInit() {
    // Sincronizar con el estado global del body
    this.isDarkMode = document.body.classList.contains('dark-mode');
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}
