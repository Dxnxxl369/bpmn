import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../services/auth.service';
import { BpmsService } from '../../services/bpms.service';
import { CollaborationService, ChatMessage } from '../../services/collaboration.service';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { AiAssistantComponent } from '../../components/ai-assistant/ai-assistant.component';
import { CollaborativeCursorsComponent } from '../../components/collaborative-cursors/collaborative-cursors.component';
import { Subscription, filter } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule, MatBadgeModule, AiAssistantComponent, CollaborativeCursorsComponent, FormsModule],
  template: `
    <div class="admin-shell-layout" [class.dark-shell]="isDarkMode" [class.sidebar-collapsed]="isCollapsed">
      
      <app-collaborative-cursors></app-collaborative-cursors>
      
      <!-- SIDEBAR INTEGRAL -->
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
            <a routerLink="departments" routerLinkActive="active-nav" class="nav-item" matTooltip="Departamentos" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>domain</mat-icon> <span *ngIf="!isCollapsed">Departamentos</span>
            </a>
            <a routerLink="executives" routerLinkActive="active-nav" class="nav-item" matTooltip="Casting Humano" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>people</mat-icon> <span *ngIf="!isCollapsed">Casting Humano</span>
            </a>
            <a routerLink="monitor" routerLinkActive="active-nav" class="nav-item" matTooltip="Monitor Global" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>monitor_heart</mat-icon> <span *ngIf="!isCollapsed">Monitor Global</span>
            </a>
            <a routerLink="reports" routerLinkActive="active-nav" class="nav-item" matTooltip="Eficiencia" [matTooltipDisabled]="!isCollapsed">
              <mat-icon>query_stats</mat-icon> <span *ngIf="!isCollapsed">Reportes Eficiencia</span>
            </a>
          </ng-container>

          <!-- ÁREA OPERATIVA SOLO PARA FUNCIONARIOS -->
          <a routerLink="monitor-ejecutivo" *ngIf="userRole === 'FUNCIONARIO'"
             routerLinkActive="active-nav" class="nav-item" matTooltip="Área Operativa" [matTooltipDisabled]="!isCollapsed">
            <mat-icon>dashboard</mat-icon> <span *ngIf="!isCollapsed">Área Operativa</span>
          </a>

          <a routerLink="profile" routerLinkActive="active-nav" class="nav-item" matTooltip="Mi Perfil" [matTooltipDisabled]="!isCollapsed">
            <mat-icon>account_circle</mat-icon> <span *ngIf="!isCollapsed">Mi Perfil</span>
          </a>
        </nav>

        <!-- UTILIDADES DE SISTEMA REUBICADAS (NOTIFICACIONES Y CHAT) -->
        <div class="sidebar-utilities">
          <div class="util-group" [class.collapsed]="isCollapsed">
            <button class="util-orb neon-box" matTooltip="Notificaciones">
              <mat-icon>notifications</mat-icon>
            </button>

            <button class="util-orb hub-trigger" 
                    [class.active]="showSocialHub" 
                    [class.has-news]="unreadMessages > 0"
                    (click)="showSocialHub = !showSocialHub"
                    matTooltip="Hub de Colaboración">
              <mat-icon>groups</mat-icon>
            </button>
          </div>
        </div>


        <div class="sidebar-footer">
          <button class="theme-mini-btn" (click)="toggleTheme()">
            <mat-icon>{{ isDarkMode ? 'light_mode' : 'dark_mode' }}</mat-icon>
            <span *ngIf="!isCollapsed">{{ isDarkMode ? 'Modo Claro' : 'Modo Oscuro' }}</span>
          </button>
          
          <div class="user-mini-card">
            <div class="mini-avatar-circular" [style.background-image]="'url(' + myAvatar + ')'" [class.with-img]="myAvatar">
               <span *ngIf="!myAvatar">{{ userName.charAt(0) }}</span>
            </div>
            <div class="mini-info" *ngIf="!isCollapsed">
              <strong>{{ userName }}</strong>
              <small>{{ userRole }}</small>
            </div>
            <button class="logout-icon-btn" (click)="logout()" matTooltip="Cerrar Sesión" *ngIf="!isCollapsed">
               <mat-icon>power_settings_new</mat-icon>
            </button>
          </div>
        </div>
      </aside>

      <section class="main-content-wrapper">
        <!-- LIENZO 100% LIMPIO SIN NAVBAR SUPERIOR -->
        <main class="admin-main">
          <router-outlet></router-outlet>
        </main>
      </section>

      <aside class="social-hub-drawer" [class.open]="showSocialHub">
        <header class="drawer-header" *ngIf="!selectedUser">
          <h3>Equipo <span>en vivo</span></h3>
          <button class="close-btn-danger" (click)="showSocialHub = false">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <header class="chat-navbar-pro animate-fade-in" *ngIf="selectedUser">
           <div class="nav-left-box">
              <button class="back-btn-pro" (click)="selectedUser = null">
                 <mat-icon>arrow_back</mat-icon>
              </button>
              <div class="user-status-box">
                 <div class="avatar-mini-pro" [style.background-image]="'url(' + selectedUser.avatar + ')'" [class.with-img]="selectedUser.avatar">
                    <span *ngIf="!selectedUser.avatar">{{ selectedUser.userName.charAt(0) }}</span>
                 </div>
                 <div class="status-info">
                    <strong>{{ selectedUser.userName }}</strong>
                    <small>En línea</small>
                 </div>
              </div>
           </div>
           <button class="close-btn-danger mini-pro" (click)="showSocialHub = false">
             <mat-icon>close</mat-icon>
           </button>
        </header>

        <div class="drawer-main-content" *ngIf="!selectedUser">
          <div class="drawer-tabs-pro">
            <button [class.active]="activeTab === 'users'" (click)="activeTab = 'users'">EN LÍNEA</button>
            <button [class.active]="activeTab === 'chat'" (click)="activeTab = 'chat'">
              CHATS <span class="badge-mini" *ngIf="unreadMessages > 0">{{ unreadMessages }}</span>
            </button>
          </div>

          <div class="scroll-area-pro scroll-custom-mini" *ngIf="activeTab === 'users'">
            <div class="user-card-social animate-pop-in" *ngFor="let user of filteredUsers">
              <div class="user-avatar-box">
                <div class="avatar-circle" [style.background-image]="'url(' + user.avatar + ')'" [class.with-img]="user.avatar">
                  <span *ngIf="!user.avatar">{{ user.userName.charAt(0) }}</span>
                </div>
                <span class="status-dot"></span>
              </div>
              <div class="user-detail">
                <strong>{{ user.userName }}</strong>
                <div class="activity-tag">
                   <mat-icon>{{ user.activityIcon || 'sensors' }}</mat-icon>
                   <div class="marquee-container">
                      <span class="marquee-text-pro">{{ user.activity || 'Navegando' }}</span>
                   </div>
                </div>
              </div>
              <button class="chat-btn-mini-pro" (click)="abrirConversacion(user)" matTooltip="Chatear">
                <mat-icon>chat_bubble</mat-icon>
              </button>
            </div>
          </div>
          
          <div class="scroll-area-pro scroll-custom-mini" *ngIf="activeTab === 'chat'">
             <div *ngFor="let conv of activeConversations" 
                  class="user-card-social inbox-item animate-pop-in"
                  (click)="abrirConversacion(conv.user)">
                <div class="user-avatar-box">
                  <div class="avatar-circle" [style.background-image]="'url(' + conv.user.avatar + ')'" [class.with-img]="conv.user.avatar">
                    <span *ngIf="!conv.user.avatar">{{ conv.user.userName.charAt(0) }}</span>
                  </div>
                  <span class="unread-dot" *ngIf="conv.unread"></span>
                </div>
                <div class="user-detail">
                  <div class="inbox-header">
                     <strong>{{ conv.user.userName }}</strong>
                     <small>{{ conv.lastMessage.timestamp | date:'HH:mm' }}</small>
                  </div>
                  <p class="last-msg-text">{{ conv.lastMessage.content }}</p>
                </div>
             </div>
             <div class="empty-social" *ngIf="activeConversations.length === 0">
                <mat-icon>chat_bubble_outline</mat-icon>
                <p>No tienes chats activos.</p>
             </div>
          </div>
        </div>

        <div class="conversation-view animate-slide-in" *ngIf="selectedUser">
           <div class="chat-messages-box scroll-custom-mini" #chatScroll>
              <div *ngFor="let msg of filteredMessages" class="msg-bubble-wrapper" [class.me]="msg.fromId === myEmail">
                 <div class="msg-bubble-pro" [style.border-left-color]="msg.fromId !== myEmail ? msg.color : 'transparent'">
                    <p>{{ msg.content }}</p>
                    <small>{{ msg.timestamp | date:'HH:mm' }}</small>
                 </div>
              </div>
           </div>
           <footer class="drawer-footer">
              <div class="quick-chat-preview">
                 <input type="text" [(ngModel)]="chatMessage" (keyup.enter)="enviarMensaje()" placeholder="Escribe un mensaje...">
                 <button (click)="enviarMensaje()" [disabled]="!chatMessage.trim()"><mat-icon>send</mat-icon></button>
              </div>
           </footer>
        </div>
      </aside>

      <app-ai-assistant></app-ai-assistant>
    </div>
  `,
  styles: [`
    .admin-shell-layout { display: flex; height: 100vh; width: 100vw; background: var(--bg-app); overflow: hidden; position: relative; }
    
    /* SIDEBAR REDISEÑADO CON UTILIDADES */
    .admin-sidebar { width: 260px; background: var(--surface); border-right: 1px solid var(--glass-border); display: flex; flex-direction: column; transition: 0.3s; z-index: 5000; position: relative; } /* Z-index con position para superar overlays */
    .sidebar-collapsed .admin-sidebar { width: 80px; }
    .sidebar-brand { height: 80px; display: flex; align-items: center; padding: 0 20px; gap: 15px; border-bottom: 1px solid var(--glass-border); position: relative; }
    .brand-orb { min-width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary-color), #e67e22); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .brand-text h1 { margin: 0; font-size: 1rem; color: var(--text-main); }
    .brand-text p { margin: 0; font-size: 0.5rem; font-weight: 900; letter-spacing: 1px; color: var(--text-muted); }

    .toggle-btn-pro { position: absolute; right: -12px; top: 25px; width: 26px; height: 26px; border-radius: 50%; background: var(--primary-color); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; box-shadow: 0 0 10px var(--primary-color); transition: 0.3s; }
    .toggle-btn-pro:hover { transform: scale(1.2); }

    .sidebar-nav { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(211, 84, 0, 0.2) transparent; }
    .sidebar-nav::-webkit-scrollbar { width: 5px; }
    .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(211, 84, 0, 0); border-radius: 10px; transition: 0.3s; }
    .sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(211, 84, 0, 0.3); }
    .sidebar-nav::-webkit-scrollbar-thumb:hover { background: var(--primary-color); }

    .nav-item { display: flex; align-items: center; gap: 15px; padding: 12px 15px; text-decoration: none; color: var(--text-muted); border-radius: 12px; font-weight: 700; transition: 0.3s; font-size: 0.85rem; flex-shrink: 0; }
    .nav-item:hover { background: rgba(211, 84, 0, 0.05); color: var(--primary-color); }
    .nav-item.active-nav { background: rgba(211, 84, 0, 0.1); color: var(--primary-color); }

    /* SECCIÓN DE UTILIDADES (NUEVO) */
    .sidebar-utilities { padding: 15px; border-top: 1px solid var(--glass-border); }
    .util-group { display: flex; gap: 15px; justify-content: center; }
    .util-group.collapsed { flex-direction: column; align-items: center; gap: 10px; }
    
    .util-orb { 
      width: 44px; height: 44px; border-radius: 14px; border: 1px solid var(--glass-border); 
      background: var(--bg-app); color: var(--text-muted); cursor: pointer; 
      display: flex; align-items: center; justify-content: center; transition: 0.3s; position: relative;
    }
    .util-orb:hover, .util-orb.active { background: var(--primary-color); color: white; border-color: var(--primary-color); box-shadow: 0 0 15px rgba(211, 84, 0, 0.3); }
    .online-count { position: absolute; top: -5px; right: -5px; background: #22c55e; color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 10px; font-weight: 900; border: 2px solid var(--surface); }

    .sidebar-footer { padding: 15px; border-top: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 10px; }
    .theme-mini-btn { background: var(--bg-app); border: 1px solid var(--glass-border); color: var(--text-muted); border-radius: 10px; padding: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.75rem; font-weight: 800; }
    .user-mini-card { display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.03); border-radius: 15px; border: 1px solid var(--glass-border); }
    .mini-avatar-circular { width: 36px; height: 36px; border-radius: 50% !important; background: var(--secondary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; background-size: cover; background-position: center; }
    .mini-avatar-circular.with-img { color: transparent; }
    .mini-info { flex: 1; overflow: hidden; }
    .mini-info strong { display: block; font-size: 0.7rem; color: var(--text-main); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .logout-icon-btn { background: transparent; border: none; color: #ff4757; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
    .logout-icon-btn:hover { transform: scale(1.2); filter: drop-shadow(0 0 5px #ff4757); }

    .main-content-wrapper { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }
    .admin-main { flex: 1; overflow: hidden; }

    /* SOCIAL DRAWER */
    .social-hub-drawer { position: absolute; top: 0; right: -400px; width: 380px; height: 100vh; background: var(--surface); border-left: 1px solid var(--glass-border); transition: 0.4s; z-index: 1500; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.1); overflow: hidden; }
    .social-hub-drawer.open { right: 0; }
    
    .drawer-header, .chat-navbar-pro { flex-shrink: 0; padding: 20px 25px; border-bottom: 1px solid var(--glass-border); display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; min-height: 80px; }
    .back-btn-pro { background: rgba(0,0,0,0.05); color: var(--text-muted); border: 1px solid var(--glass-border); width: 34px; height: 34px; border-radius: 50%; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; }
    .back-btn-pro:hover { color: var(--primary-color); border-color: var(--primary-color); transform: translateX(-3px); }
    .avatar-mini-pro { width: 34px; height: 34px; border-radius: 50% !important; background: #333; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1); background-size: cover; background-position: center; }
    .avatar-mini-pro.with-img { color: transparent; }
    .status-info strong { font-size: 0.85rem; color: var(--text-main); display: block; line-height: 1; }
    .status-info small { font-size: 0.55rem; color: #22c55e; font-weight: 950; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 4px; margin-top: 4px; }
    .status-info small::before { content: ''; width: 5px; height: 5px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 5px #22c55e; }
    .close-btn-danger { background: rgba(255, 71, 87, 0.1) !important; color: #ff4757 !important; border: 1px solid rgba(255, 71, 87, 0.3) !important; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
    .close-btn-danger:hover { background: #ff4757; color: white; transform: rotate(90deg); box-shadow: 0 0 15px #ff4757; }

    .drawer-main-content, .conversation-view { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .scroll-area-pro, .chat-messages-box { flex: 1; overflow-y: auto; padding: 25px; width: 100%; box-sizing: border-box; }
    .drawer-tabs-pro { display: flex; gap: 10px; padding: 20px; flex-shrink: 0; }
    .drawer-tabs-pro button { flex: 1; border: none; background: rgba(0,0,0,0.05); color: var(--text-muted); padding: 12px; border-radius: 12px; font-size: 0.65rem; font-weight: 950; cursor: pointer; transition: 0.3s; letter-spacing: 1px; }
    .drawer-tabs-pro button.active { background: var(--primary-color); color: white; box-shadow: 0 5px 15px rgba(211, 84, 0, 0.3); }

    .user-card-social { display: flex; align-items: center; gap: 15px; padding: 15px; border-radius: 20px; background: var(--bg-app); margin-bottom: 12px; transition: 0.3s; border: 1px solid transparent; justify-content: space-between !important; }
    .avatar-circle { width: 40px; height: 40px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-weight: 900; position: relative; background-size: cover; background-position: center; border: 2px solid rgba(255,255,255,0.1); }
    .avatar-circle.with-img { color: transparent; }
    .status-dot { position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #22c55e; border-radius: 50%; border: 2px solid var(--bg-app); }
    
    .activity-tag { display: flex; align-items: center; gap: 5px; margin-top: 4px; overflow: hidden; }
    .activity-tag mat-icon { font-size: 13px; width: 13px; height: 13px; color: var(--primary-color); flex-shrink: 0; }
    .marquee-container { flex: 1; overflow: hidden; white-space: nowrap; }
    .marquee-text-pro { display: inline-block; padding-left: 100%; font-size: 0.65rem; color: var(--primary-color); font-weight: 800; animation: marquee-social 12s linear infinite; }
    @keyframes marquee-social { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

    .chat-btn-mini-pro { flex-shrink: 0; width: 38px; height: 38px; border-radius: 12px; background: #1a1a1a !important; color: var(--primary-color) !important; border: 1px solid rgba(211, 84, 0, 0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
    .chat-btn-mini-pro:hover { background: var(--primary-color) !important; color: white !important; transform: scale(1.1); }

    .msg-bubble-pro { max-width: 85%; padding: 12px 18px; border-radius: 18px; background: var(--bg-app); border: 1px solid var(--glass-border); width: fit-content !important; }
    .me .msg-bubble-pro { background: var(--primary-color); color: white; border-color: var(--primary-color); border-bottom-right-radius: 4px; }
    .msg-bubble-pro p { margin: 0; font-size: 0.9rem; line-height: 1.4; }
    .msg-bubble-pro small { font-size: 0.6rem; opacity: 0.7; display: block; margin-top: 6px; text-align: right; }

    .drawer-footer { flex-shrink: 0; padding: 20px 25px; border-top: 1px solid var(--glass-border); background: var(--surface); }
    .quick-chat-preview { display: flex; background: var(--bg-app); border-radius: 50px; padding: 5px 5px 5px 15px; border: 1px solid var(--glass-border); }
    .quick-chat-preview input { border: none; background: transparent; outline: none; color: var(--text-main); font-size: 0.85rem; flex: 1; }
    .quick-chat-preview button { background: var(--primary-color); color: white; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; }
    .animate-slide-in { animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `]
})
export class AdminShellComponent implements OnInit, OnDestroy {
  @ViewChild('chatScroll') private chatScrollContainer?: ElementRef;
  userName = 'Usuario'; userRole = ''; myEmail = ''; myAvatar = ''; isDarkMode = false; isCollapsed = false; showSocialHub = false; activeTab: 'users' | 'chat' = 'users'; 
  onlineUsers: any[] = []; messages: ChatMessage[] = []; chatMessage = ''; unreadMessages = 0; currentPolicyName = ''; currentPolicyId: string | null = null; selectedUser: any | null = null; 
  private subs = new Subscription();

  constructor(private authService: AuthService, private router: Router, private collabService: CollaborationService, private aiService: AiAssistantService, private cdr: ChangeDetectorRef, private dialog: MatDialog) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userName = `${user.nombre} ${user.apellido}`;
        this.userRole = user.rol;
        this.myEmail = user.email;
        this.myAvatar = user.avatar;
        this.cdr.detectChanges();
      }
    });

    this.collabService.conectarGlobal();
    
    // Anuncio inicial inmediato
    this.actualizarActividad();

    this.subs.add(this.collabService.globalPresence$.subscribe(users => { this.onlineUsers = users; this.cdr.detectChanges(); }));
    this.subs.add(this.collabService.chatMessages$.subscribe(msgs => {
      this.messages = msgs;
      if (!this.showSocialHub || !this.selectedUser) this.unreadMessages++;
      this.scrollToBottom();
      this.cdr.detectChanges();
    }));
    this.subs.add(this.aiService.currentContext$.subscribe(ctx => {
      this.currentPolicyName = (ctx.name && ctx.name !== 'General') ? ctx.name : '';
      this.currentPolicyId = ctx.id || null;
      // Emitir inmediatamente al cambiar de contexto (isla)
      this.actualizarActividad();
    }));
    this.subs.add(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.actualizarActividad()));
  }

  get activeConversations() {
    const convs = new Map<string, any>();
    this.messages.forEach(m => {
      const otherId = m.fromId === this.myEmail ? m.toId : m.fromId;
      if (!otherId) return;
      const otherUser = this.onlineUsers.find(u => u.userId === otherId) || { userId: otherId, userName: m.fromId === this.myEmail ? 'Usuario' : m.from, color: m.color, avatar: '' };
      convs.set(otherId, { user: otherUser, lastMessage: m, unread: false });
    });
    return Array.from(convs.values()).sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  }

  get filteredMessages() {
    if (!this.selectedUser) return [];
    return this.messages.filter(m => (m.fromId === this.selectedUser.userId && m.toId === this.myEmail) || (m.fromId === this.myEmail && m.toId === this.selectedUser.userId));
  }

  get filteredUsers() { 
    const uniqueUsers = new Map<string, any>();
    
    // Ordenar por timestamp descendente para tener la actividad más reciente
    const sorted = [...this.onlineUsers].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    for (const u of sorted) {
      const isOtherSession = u.sessionId !== (this.collabService as any).sessionId;
      
      // ELIMINADO EL FILTRO DE POLÍTICA AQUÍ: El chat debe ser global.
      if (isOtherSession && !uniqueUsers.has(u.userId)) {
        uniqueUsers.set(u.userId, u);
      }
    }
    
    return Array.from(uniqueUsers.values());
  }
  abrirConversacion(user: any) { this.selectedUser = user; this.unreadMessages = 0; this.scrollToBottom(); }
  enviarMensaje() {
    if (!this.chatMessage.trim() || !this.selectedUser) return;
    this.collabService.enviarMensajePrivado(this.selectedUser.userId, this.chatMessage);
    this.chatMessage = '';
    this.scrollToBottom();
  }

  actualizarActividad() {
    const url = this.router.url;
    let activity = 'Navegando'; let icon = 'sensors';
    if (url.includes('designer')) activity = this.currentPolicyName ? `Diseñando: ${this.currentPolicyName}` : 'En el Diseñador';
    else if (url.includes('departments')) activity = 'Gestionando Deptos';
    else if (url.includes('executives')) activity = 'Casting Humano';
    else if (url.includes('monitor')) activity = 'Monitor Global';
    
    // ENVIAR ACTIVIDAD CON ID DE POLÍTICA (SALA)
    this.collabService.enviarActividadGlobal(activity, icon, 'active', this.currentPolicyId);
  }

  toggleTheme() { this.isDarkMode = !this.isDarkMode; if (this.isDarkMode) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode'); }
  
  logout() { 
    this.dialog.closeAll(); // Cierra todos los diálogos abiertos antes de salir
    this.collabService.limpiarHistorialSesion(); 
    this.collabService.desconectarGlobal(); 
    this.authService.logout(); 
    this.router.navigate(['/login']); 
  }

  private scrollToBottom(): void {
    setTimeout(() => { if (this.chatScrollContainer) this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight; }, 100);
  }

  ngOnDestroy() { this.subs.unsubscribe(); this.collabService.desconectarGlobal(); }
}
