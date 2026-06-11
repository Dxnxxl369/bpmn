import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../services/auth.service';
import { CollaborationService, ChatMessage } from '../../services/collaboration.service';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { AiAssistantComponent } from '../../components/ai-assistant/ai-assistant.component';
import { Subscription, filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { BpmsService } from '../../services/bpms.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule, MatBadgeModule, AiAssistantComponent, FormsModule],
  template: `
    <div class="admin-shell-layout" [class.dark-shell]="isDarkMode" [class.sidebar-collapsed]="isCollapsed">
      
      <aside class="admin-sidebar">
        <div class="sidebar-brand">
          <div class="brand-orb"><mat-icon>hub</mat-icon></div>
          <div class="brand-text" *ngIf="!isCollapsed">
            <h1>BPMS <span>Suite</span></h1>
            <p>AI ORCHESTRATED</p>
          </div>
          <button class="toggle-btn-pro" (click)="isCollapsed = !isCollapsed">
            <mat-icon>{{ isCollapsed ? 'menu' : 'menu_open' }}</mat-icon>
          </button>
        </div>
        
        <nav class="sidebar-nav">
          <ng-container *ngIf="userRole === 'ADMINISTRADOR'">
            <a routerLink="designer" routerLinkActive="active-nav" class="nav-item" matTooltip="Diseñador IA" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>architecture</mat-icon> <span *ngIf="!isCollapsed">Diseñador IA</span>
            </a>
            <a routerLink="reports" routerLinkActive="active-nav" class="nav-item" matTooltip="Cuellos de Botella" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>hourglass_empty</mat-icon> <span *ngIf="!isCollapsed">Cuellos de Botella</span>
            </a>
            <a routerLink="departments" routerLinkActive="active-nav" class="nav-item" matTooltip="Departamentos" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>domain</mat-icon> <span *ngIf="!isCollapsed">Departamentos</span>
            </a>
            <a routerLink="executives" routerLinkActive="active-nav" class="nav-item" matTooltip="Casting Humano" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>people</mat-icon> <span *ngIf="!isCollapsed">Casting Humano</span>
            </a>
            <a routerLink="monitor" routerLinkActive="active-nav" class="nav-item" matTooltip="Monitor Global" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>monitor_heart</mat-icon> <span *ngIf="!isCollapsed">Monitor Global</span>
            </a>
            <a routerLink="reportes-ia" routerLinkActive="active-nav" class="nav-item" matTooltip="Reportes IA" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>assessment</mat-icon> <span *ngIf="!isCollapsed">Reportes IA</span>
            </a>
            <a routerLink="bitacora" routerLinkActive="active-nav" class="nav-item" matTooltip="Bitácora" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>history_edu</mat-icon> <span *ngIf="!isCollapsed">Bitácora</span>
            </a>
          </ng-container>

          <!-- NAVEGACIÓN PARA FUNCIONARIO -->
          <ng-container *ngIf="userRole === 'FUNCIONARIO'">
            <a routerLink="monitor-ejecutivo" routerLinkActive="active-nav" class="nav-item" matTooltip="Mi Monitor" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>terminal</mat-icon> <span *ngIf="!isCollapsed">Mi Monitor</span>
            </a>
          </ng-container>

          <a routerLink="profile" routerLinkActive="active-nav" class="nav-item" matTooltip="Mi Perfil" [matTooltipDisabled]="!isCollapsed">
            <mat-icon>account_circle</mat-icon> <span *ngIf="!isCollapsed">Mi Perfil</span>
          </a>
        </nav>

        <div class="sidebar-utilities">
          <div class="live-team-trigger" [class.active]="showSocialHub" (click)="showSocialHub = !showSocialHub">
            <div class="live-indicator-wrapper">
              <mat-icon>groups</mat-icon>
              <span class="online-dot-pulse" *ngIf="onlineUsers.length > 0"></span>
            </div>
            <div class="live-team-label" *ngIf="!isCollapsed">
              <span>Equipo en vivo</span>
              <small>{{ filteredUsers.length }} activos</small>
            </div>
            <span class="unread-badge" *ngIf="unreadMessages > 0">{{ unreadMessages }}</span>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="user-mini-card">
            <div class="mini-avatar-circular" [style.background-image]="'url(' + myAvatar + ')'" [class.with-img]="myAvatar">
               <span *ngIf="!myAvatar">{{ userName.charAt(0) }}</span>
            </div>
            <div class="mini-info" *ngIf="!isCollapsed">
              <strong>{{ userName }}</strong>
              <small>{{ userRole }}</small>
            </div>
          </div>
          
          <!-- BOTÓN MODO CLARO/OSCURO -->
          <button class="theme-toggle-orb" (click)="toggleTheme()" matTooltip="Cambiar Tema">
            <mat-icon>{{ isDarkMode ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>

          <button class="logout-icon-btn-final" (click)="logout()" *ngIf="!isCollapsed">
             <mat-icon>power_settings_new</mat-icon> SALIR
          </button>
        </div>
      </aside>

      <section class="main-content-wrapper">
        <main class="admin-main"><router-outlet></router-outlet></main>
      </section>

      <!-- HUB SOCIAL PREMIUM (COLABORADORES Y CHAT) -->
      <aside class="social-hub-drawer" [class.open]="showSocialHub">
        <header class="drawer-header-premium">
          <div class="header-left">
             <mat-icon>diversity_3</mat-icon>
             <h3>Equipo <span>en vivo</span></h3>
          </div>
          <button class="close-btn-danger-pro" (click)="showSocialHub = false">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <!-- SELECTOR DE PESTAÑAS -->
        <div class="tabs-navigator-pro">
          <button [class.active]="activeTab === 'users'" (click)="activeTab = 'users'; selectedUser = null">
            <mat-icon>sensors</mat-icon> ACTIVOS
          </button>
          <button [class.active]="activeTab === 'chat'" (click)="activeTab = 'chat'">
            <mat-icon [matBadge]="unreadMessages" matBadgeColor="warn" [matBadgeHidden]="unreadMessages === 0">chat_bubble</mat-icon> CHATS
          </button>
        </div>

        <div class="drawer-main-content">
          <!-- PESTAÑA: ACTIVOS -->
          <div class="scroll-area-premium scroll-custom-mini" *ngIf="activeTab === 'users'">
            <div class="user-card-premium" *ngFor="let user of filteredUsers">
              <div class="avatar-ring-pro">
                <div class="avatar-main" [style.background-image]="'url(' + (user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.userId) + ')'" [class.with-img]="user.avatar">
                  <span *ngIf="!user.avatar">{{ user.userName.charAt(0) }}</span>
                </div>
                <span class="pulse-status"></span>
              </div>
              <div class="user-info-pro">
                <strong>{{ user.userName }}</strong>
                <span class="activity-text">{{ user.activity || 'En línea' }}</span>
              </div>
              <button class="chat-trigger-btn" (click)="abrirConversacionDesdeActivos(user)">
                <mat-icon>send</mat-icon>
              </button>
            </div>
            <div class="empty-social-pro" *ngIf="filteredUsers.length === 0">
               <mat-icon>cloud_off</mat-icon>
               <p>No hay otros colegas activos.</p>
            </div>
          </div>

          <!-- PESTAÑA: CHATS (MESSENGER STYLE) -->
          <div class="scroll-area-premium scroll-custom-mini" *ngIf="activeTab === 'chat'">
            <div class="user-card-premium messenger-item" *ngFor="let user of filteredUsers" (click)="abrirConversacion(user)">
              <div class="avatar-ring-pro">
                <div class="avatar-main" [style.background-image]="'url(' + user.avatar + ')'" [class.with-img]="user.avatar">
                  <span *ngIf="!user.avatar">{{ user.userName.charAt(0) }}</span>
                </div>
                <span class="unread-dot-mini" *ngIf="unreadSenders.has(user.userId)"></span>
              </div>
              <div class="user-info-pro">
                <div class="user-name-row">
                  <strong>{{ user.userName }}</strong>
                </div>
                <span class="last-msg-preview">{{ getLastMessagePreview(user.userId) || 'Toca para iniciar chat' }}</span>
              </div>
              <mat-icon class="chevron-icon">chevron_right</mat-icon>
            </div>
            <div class="empty-social-pro" *ngIf="filteredUsers.length === 0">
               <mat-icon>forum</mat-icon>
               <p>No tienes chats activos.</p>
            </div>
          </div>

          <!-- VISTA DE CHAT PRIVADO (CAPA SUPERIOR - SOLO EN PESTAÑA CHAT) -->
          <div class="chat-container-premium animate-slide-in" *ngIf="selectedUser && activeTab === 'chat'">
             <header class="chat-active-header">
                <button class="back-btn-pro" (click)="selectedUser = null"><mat-icon>arrow_back</mat-icon></button>
                <div class="header-user-info">
                   <div class="avatar-mini-pro" [style.background-image]="'url(' + selectedUser.avatar + ')'" [class.with-img]="selectedUser.avatar">
                      <span *ngIf="!selectedUser.avatar">{{ selectedUser.userName.charAt(0) }}</span>
                   </div>
                   <span>{{ selectedUser.userName }}</span>
                </div>
             </header>
             <div class="messages-list scroll-custom-mini" #chatScroll>
                <div *ngFor="let msg of filteredMessages" class="msg-row" [class.me]="msg.fromId === myEmail">
                   <div class="bubble-premium">
                      <p>{{ msg.content }}</p>
                      <small>{{ msg.timestamp | date:'HH:mm' }}</small>
                   </div>
                </div>
             </div>
             <footer class="chat-footer-premium">
                <input type="text" [(ngModel)]="chatMessage" (keyup.enter)="enviarMensaje()" placeholder="Escribe un mensaje...">
                <button class="send-btn-pro" (click)="enviarMensaje()"><mat-icon>send</mat-icon></button>
             </footer>
          </div>
        </div>
      </aside>

      <app-ai-assistant></app-ai-assistant>
    </div>
  `,
  styles: [`
    .admin-shell-layout { display: flex; height: 100vh; width: 100vw; background: var(--bg-app); overflow: hidden; position: relative; font-family: 'Inter', sans-serif; transition: background 0.4s ease; }
    
    .admin-sidebar { width: 260px; background: var(--surface); border-right: 1px solid var(--glass-border); display: flex; flex-direction: column; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 5000; position: relative; }
    .sidebar-collapsed .admin-sidebar { width: 80px; }
    
    .sidebar-brand { height: 80px; display: flex; align-items: center; padding: 0 20px; gap: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative; }
    .brand-orb { min-width: 40px; height: 40px; background: #d35400; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(211, 84, 0, 0.4); }
    .brand-text h1 { margin: 0; font-size: 1rem; color: #fff; white-space: nowrap; }
    .brand-text p { margin: 0; font-size: 0.5rem; font-weight: 900; letter-spacing: 1px; color: #666; }

    .toggle-btn-pro { position: absolute; right: -12px; top: 25px; width: 26px; height: 26px; border-radius: 50%; background: #d35400; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; box-shadow: 0 0 10px rgba(211, 84, 0, 0.4); transition: 0.3s; }
    
    .sidebar-nav { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; overflow-x: hidden; }
    .nav-item { display: flex; align-items: center; gap: 15px; padding: 12px 15px; color: #888; text-decoration: none; border-radius: 12px; font-weight: 600; transition: 0.2s; white-space: nowrap; }
    .nav-item:hover, .nav-item.active-nav { background: rgba(211, 84, 0, 0.1); color: #fff; }
    .nav-item.active-nav mat-icon { color: #d35400; }

    .sidebar-utilities { padding: 10px; border-top: 1px solid rgba(255,255,255,0.05); }
    .live-team-trigger { 
      display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(34, 197, 94, 0.05); 
      border-radius: 15px; border: 1px solid rgba(34, 197, 94, 0.1); cursor: pointer; transition: 0.3s; position: relative;
    }
    .live-team-trigger:hover, .live-team-trigger.active { background: rgba(34, 197, 94, 0.15); border-color: #22c55e; }
    
    .live-indicator-wrapper { position: relative; display: flex; align-items: center; justify-content: center; color: #22c55e; }
    .online-dot-pulse { 
      position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #22c55e; 
      border-radius: 50%; box-shadow: 0 0 10px #22c55e; animation: pulse-green 2s infinite; 
    }
    @keyframes pulse-green { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }

    .live-team-label { display: flex; flex-direction: column; line-height: 1.2; }
    .live-team-label span { color: var(--text-main); font-size: 0.8rem; font-weight: 700; }
    .live-team-label small { color: #2ecc71; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(46, 204, 113, 0.2); }

    .unread-badge { 
      position: absolute; top: -8px; right: -8px; background: #ff4757; color: white; 
      font-size: 0.7rem; font-weight: 900; padding: 2px 7px; border-radius: 10px; border: 2px solid var(--surface);
      animation: badgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 4px 10px rgba(255, 71, 87, 0.4);
    }
    @keyframes badgePop { from { transform: scale(0); } to { transform: scale(1); } }

    .sidebar-footer { padding: 15px; border-top: 1px solid rgba(255,255,255,0.05); }
    .user-mini-card { display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 15px; overflow: hidden; }
    .mini-avatar-circular { min-width: 36px; height: 36px; border-radius: 50%; background: #333; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; }
    .mini-info { flex: 1; overflow: hidden; }
    .mini-info strong { display: block; font-size: 0.75rem; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .mini-info small { font-size: 0.65rem; color: #666; text-transform: uppercase; }

    .logout-icon-btn-final { margin-top: 10px; width: 100%; padding: 10px; background: rgba(255, 71, 87, 0.1); color: #ff4757; border: 1px solid rgba(255, 71, 87, 0.2); border-radius: 10px; cursor: pointer; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.3s; }
    .logout-icon-btn-final:hover { background: #ff4757; color: white; }

    .theme-toggle-orb { 
      background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); 
      color: #888; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; 
      display: flex; align-items: center; justify-content: center; transition: 0.3s;
      margin-left: 10px;
    }
    .theme-toggle-orb:hover { background: rgba(211, 84, 0, 0.2); color: #d35400; border-color: #d35400; transform: rotate(30deg); }
    .theme-toggle-orb mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .social-hub-drawer { position: absolute; top: 15px; right: -420px; width: 380px; height: calc(100vh - 30px); background: #111114; border: 1px solid rgba(255,255,255,0.08); border-radius: 25px; transition: 0.5s cubic-bezier(0.19, 1, 0.22, 1); z-index: 6000; display: flex; flex-direction: column; box-shadow: -20px 0 60px rgba(0,0,0,0.6); }
    .social-hub-drawer.open { right: 20px; }

    .tabs-navigator-pro { display: flex; padding: 10px 20px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05); gap: 10px; }
    .tabs-navigator-pro button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: none; border: none; border-radius: 12px; color: #666; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: 0.3s; }
    .tabs-navigator-pro button.active { background: rgba(211, 84, 0, 0.1); color: #d35400; }
    .tabs-navigator-pro button mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .drawer-header-premium { padding: 25px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 15px; color: #fff; }
    .header-left mat-icon { color: #d35400; font-size: 28px; width: 28px; height: 28px; }
    .header-left h3 span { color: #d35400; }

    .close-btn-danger-pro { background: #e74c3c !important; color: white !important; border: none; width: 32px; height: 32px; border-radius: 10px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; }
    .close-btn-danger-pro:hover { transform: rotate(90deg); box-shadow: 0 0 20px #e74c3c; }

    .drawer-main-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; position: relative; }
    .scroll-area-premium { flex: 1; overflow-y: auto; padding: 20px; }
    .user-card-premium { display: flex; align-items: center; gap: 15px; padding: 15px; background: #1a1a1e; margin-bottom: 12px; border-radius: 18px; transition: 0.3s; border: 1px solid transparent; }
    .user-card-premium:hover { border-color: #d35400; transform: translateX(-5px); }
    .messenger-item { cursor: pointer; }
    .chevron-icon { color: #333; transition: 0.3s; }
    .messenger-item:hover .chevron-icon { color: #d35400; transform: translateX(3px); }
    
    .avatar-ring-pro { position: relative; width: 44px; height: 44px; padding: 2px; border: 2px solid #d35400; border-radius: 50%; }
    .avatar-main { width: 100%; height: 100%; border-radius: 50%; background: #333; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; }
    .pulse-status { position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: #22c55e; border-radius: 50%; border: 2px solid #111114; }

    .user-info-pro { flex: 1; min-width: 0; }
    .user-name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .user-name-row strong { color: #fff; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    .unread-dot-mini { width: 10px; height: 10px; background: #ff4757; border-radius: 50%; box-shadow: 0 0 10px #ff4757; animation: badgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); flex-shrink: 0; }
    
    .activity-text { color: #d35400; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; display: block; }
    .last-msg-preview { color: #888; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; margin-top: 2px; }

    .chat-trigger-btn { margin-left: 5px; background: none; border: none; color: #444; cursor: pointer; transition: 0.3s; flex-shrink: 0; }
    .chat-trigger-btn:hover { color: #d35400; }

    .chat-container-premium { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #0a0a0c; display: flex; flex-direction: column; z-index: 10; border-radius: 25px; }
    .chat-active-header { padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; display: flex; align-items: center; gap: 15px; }
    .back-btn-pro { background: none; border: none; color: #666; cursor: pointer; }
    .header-user-info { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 0.9rem; }
    .avatar-mini-pro { width: 30px; height: 30px; border-radius: 50%; background: #333; background-size: cover; background-position: center; }
    .messages-list { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .msg-row { display: flex; width: 100%; }
    .msg-row.me { justify-content: flex-end; }
    .bubble-premium { max-width: 80%; padding: 12px 16px; border-radius: 18px; background: #1a1a1e; color: #ccc; border: 1px solid rgba(255,255,255,0.05); position: relative; }
    .bubble-premium p { margin: 0; font-size: 0.85rem; line-height: 1.4; }
    .bubble-premium small { font-size: 0.6rem; color: #555; display: block; margin-top: 5px; text-align: right; }
    .me .bubble-premium { background: #d35400; color: white; border: none; }
    .chat-footer-premium { padding: 20px; display: flex; gap: 10px; background: #111114; }
    .chat-footer-premium input { flex: 1; background: #1a1a1e; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 18px; color: white; outline: none; }
    .send-btn-pro { width: 45px; height: 45px; background: #d35400; color: white; border: none; border-radius: 12px; cursor: pointer; }

    .main-content-wrapper { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    .admin-main { flex: 1; height: 100%; overflow: hidden; position: relative; }
  `]
})
export class AdminShellComponent implements OnInit, OnDestroy {
  @ViewChild('chatScroll') private chatScrollContainer?: ElementRef;
  userName = '...'; userRole = ''; myEmail = ''; myAvatar = ''; isDarkMode = false; isCollapsed = false; showSocialHub = false; activeTab: 'users' | 'chat' = 'users';
  onlineUsers: any[] = []; messages: any[] = []; chatMessage = ''; unreadMessages = 0; currentPolicyName = ''; currentPolicyId: string | null = null; selectedUser: any | null = null;
  
  // CACHÉ DE PERFILES (Para no enviar fotos por WS)
  private allExecutives: any[] = [];
  
  private subs = new Subscription();

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private collabService: CollaborationService, 
    private aiService: AiAssistantService, 
    private cdr: ChangeDetectorRef, 
    private dialog: MatDialog,
    private bpmsService: BpmsService
  ) {}

  unreadSenders = new Set<string>();
  lastMessagesMap = new Map<string, any>();
  private notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

  ngOnInit() {
    this.notificationSound.load();
    // Cargar base de datos de ejecutivos para tener sus fotos
    this.bpmsService.listarEjecutivos().subscribe((data: any[]) => {
        this.allExecutives = data;
        this.cdr.detectChanges();
    });

    this.authService.user$.subscribe(user => { 
      if (user) { 
        this.userName = this.authService.getNombreCompleto(); 
        this.userRole = user.rol; 
        this.myEmail = user.email; 
        this.myAvatar = user.avatar; 
        this.collabService.enviarActividadGlobal('En línea', 'sensors', 'active', null);
        this.cdr.detectChanges(); 
      } 
    });
    
    this.collabService.conectarGlobal();
    this.subs.add(this.collabService.globalPresence$.subscribe((users: any[]) => { 
      this.onlineUsers = [...users]; 
      this.cdr.detectChanges(); 
    }));

    this.subs.add(this.collabService.chatMessages$.subscribe((msgs: any[]) => { 
        this.messages = msgs; 
        
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg) {
            // Actualizar mapa de últimos mensajes (estilo Messenger)
            const otherId = lastMsg.fromId === this.myEmail ? lastMsg.toId : lastMsg.fromId;
            if (otherId) this.lastMessagesMap.set(otherId, lastMsg);

            // LÓGICA DE NOTIFICACIONES Y FEEDBACK SENSORIAL
            if (lastMsg.fromId !== this.myEmail) {
                if (!this.showSocialHub || (this.selectedUser && this.selectedUser.userId !== lastMsg.fromId)) {
                    this.unreadSenders.add(lastMsg.fromId);
                    this.unreadMessages = this.unreadSenders.size;
                    
                    // Feedback: Sonido y Vibración
                    this.playNotification();
                }
            }
        }

        this.scrollToBottom(); 
        this.cdr.detectChanges(); 
    }));
    this.subs.add(this.aiService.currentContext$.subscribe(ctx => { this.currentPolicyName = (ctx.name && ctx.name !== 'General') ? ctx.name : ''; this.currentPolicyId = ctx.id || null; this.actualizarActividad(); }));
    this.subs.add(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.actualizarActividad()));
  }

  private playNotification() {
    try {
        this.notificationSound.play().catch(() => {});
        if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (e) {}
  }

  get filteredUsers() { 
    if (!this.onlineUsers || !this.myEmail) return [];
    const userMap = new Map<string, any>();
    
    this.onlineUsers.forEach(u => { 
        if (u.userId === this.myEmail) return; 
        
        const dbUser = this.allExecutives.find(exec => exec.email === u.userId);
        if (dbUser && dbUser.avatar) u.avatar = dbUser.avatar;

        if (!userMap.has(u.userId) || (u.timestamp || 0) > (userMap.get(u.userId).timestamp || 0)) {
            userMap.set(u.userId, u); 
        }
    });
    
    // ORDENAR: Primero los que tienen mensajes sin leer, luego por timestamp
    return Array.from(userMap.values()).sort((a, b) => {
        const aUnread = this.unreadSenders.has(a.userId) ? 1 : 0;
        const bUnread = this.unreadSenders.has(b.userId) ? 1 : 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }

  getLastMessagePreview(userId: string): string {
    const msg = this.lastMessagesMap.get(userId);
    if (!msg) return '';
    const prefix = msg.fromId === this.myEmail ? 'Tú: ' : '';
    const text = msg.content.length > 30 ? msg.content.substring(0, 27) + '...' : msg.content;
    return prefix + text;
  }

  abrirConversacion(user: any) { 
    this.selectedUser = user; 
    this.unreadSenders.delete(user.userId);
    this.unreadMessages = this.unreadSenders.size;
    this.scrollToBottom(); 
  }

  abrirConversacionDesdeActivos(user: any) {
    this.activeTab = 'chat';
    this.abrirConversacion(user);
  }

  get filteredMessages() {
    if (!this.selectedUser) return [];
    return this.messages.filter(m => 
      (m.fromId === this.selectedUser.userId && m.toId === this.myEmail) || 
      (m.fromId === this.myEmail && m.toId === this.selectedUser.userId)
    );
  }

  enviarMensaje() { if (!this.chatMessage.trim() || !this.selectedUser) return; this.collabService.enviarMensajePrivado(this.selectedUser.userId, this.chatMessage); this.chatMessage = ''; this.scrollToBottom(); }
  actualizarActividad() { const url = this.router.url; let activity = 'Navegando'; if (url.includes('designer')) activity = this.currentPolicyName ? `Editando: ${this.currentPolicyName}` : 'En el Diseñador'; else if (url.includes('departments')) activity = 'Departamentos'; else if (url.includes('executives')) activity = 'Casting Humano'; this.collabService.enviarActividadGlobal(activity, 'sensors', 'active', this.currentPolicyId); }
  toggleTheme() { 
    this.isDarkMode = !this.isDarkMode; 
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
    this.cdr.detectChanges();
  }
  logout() { this.dialog.closeAll(); this.collabService.desconectarGlobal(); this.authService.logout(); this.router.navigate(['/login']); }
  private scrollToBottom(): void { setTimeout(() => { if (this.chatScrollContainer) this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight; }, 100); }
  ngOnDestroy() { this.subs.unsubscribe(); this.collabService.desconectarGlobal(); }
}
