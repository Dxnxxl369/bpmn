import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import * as SockJSModule from 'sockjs-client';
const SockJSClass = (SockJSModule as any).default || SockJSModule;

export interface ChatMessage { from: string; fromId: string; content: string; color?: string; timestamp: number; toId?: string; avatar?: string; }

export interface CursorPosition {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  sessionId: string;
  avatar?: string;
  key?: string;
  loc?: string;
  text?: string;
}

@Injectable({ providedIn: 'root' })
export class CollaborationService {
  private socialClient: Client;
  private engineClient: Client;

  public sessionId: string;
  private currentLocalId: string | null = null;
  private userColor: string;
  private colors = ['#ff6b13', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#eab308'];
  
  private localSubscriptions: any[] = [];
  private heartbeatInterval: any;

  // ESTADO ACTUAL PARA EL LATIDO
  private currentActivity: string = 'En línea';
  private currentIcon: string = 'sensors';

  // Observables para los componentes
  private globalPresenceSubject = new BehaviorSubject<any[]>([]);
  globalPresence$ = this.globalPresenceSubject.asObservable();

  private chatMessagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  chatMessages$ = this.chatMessagesSubject.asObservable();

  private cursorsSubject = new BehaviorSubject<any[]>([]);
  cursors$ = this.cursorsSubject.asObservable();

  private diagramSyncSubject = new Subject<any>();
  diagramSync$ = this.diagramSyncSubject.asObservable();

  private diagramMoveSyncSubject = new Subject<any>();
  diagramMoveSync$ = this.diagramMoveSyncSubject.asObservable();

  private schemaSyncSubject = new BehaviorSubject<any | null>(null);
  schemaSync$ = this.schemaSyncSubject.asObservable();

  private aiHighlightSubject = new Subject<any>();
  aiHighlight$ = this.aiHighlightSubject.asObservable();

  public activeDiagramSubject = new BehaviorSubject<any | null>(null);
  activeDiagram$ = this.activeDiagramSubject.asObservable();

  constructor(private authService: AuthService) {
    this.sessionId = Math.random().toString(36).substring(2, 15);
    this.userColor = this.colors[Math.floor(Math.random() * this.colors.length)];
    const serverIp = window.location.hostname;

    // 1. TÚNEL SOCIAL (Presencia, Chat, Formularios)
    this.socialClient = new Client({
      webSocketFactory: () => new SockJSClass(`http://${serverIp}:8080/ws-bpms`),
      reconnectDelay: 2000,
      onConnect: () => {
        console.log("✅ [SOCKET-SOCIAL] CONECTADO");
        this.suscribirSocial();
        if (this.currentLocalId) this.resuscribirSocial(this.currentLocalId);
        this.iniciarLatido(); // Iniciar latido para visibilidad en vivo
      },
      onDisconnect: () => this.detenerLatido()
    });

    // 2. TÚNEL LIVE (Ingeniería, Movimientos)
    this.engineClient = new Client({
      webSocketFactory: () => new SockJSClass(`http://${serverIp}:8080/ws-live`),
      reconnectDelay: 2000,
      onConnect: () => {
        console.log("🚀 [SOCKET-LIVE] CONECTADO");
        if (this.currentLocalId) this.resuscribirLive(this.currentLocalId);
      }
    });

    this.socialClient.activate();
    this.engineClient.activate();

    // Limpieza al cerrar pestaña
    window.addEventListener('beforeunload', () => this.desconectarGlobal());
  }

  private iniciarLatido() {
    this.detenerLatido();
    // LATIDO ULTRA-LIGERO (Cada 10 segundos)
    this.heartbeatInterval = setInterval(() => {
        this.enviarActividadGlobal(this.currentActivity, this.currentIcon, 'active', this.currentLocalId, true);
    }, 10000);
  }

  private detenerLatido() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  private suscribirSocial() {
    this.globalPresenceSubject.next([]);

    this.socialClient.subscribe('/topic/global-presence', (msg) => {
        const users = JSON.parse(msg.body);
        this.globalPresenceSubject.next(users);
    });

    const myEmail = this.authService.getEmail();
    if (myEmail) {
        this.socialClient.subscribe(`/topic/chat/${myEmail}`, (msg) => {
            const data = JSON.parse(msg.body);
            this.chatMessagesSubject.next([...this.chatMessagesSubject.value, data].slice(-50));
        });
    }
    
    setTimeout(() => {
        if (this.socialClient.connected) {
            this.enviarActividadGlobal('En línea', 'sensors', 'join', null);
        }
    }, 2000);
  }

  conectar(pId: string) {
    if (this.currentLocalId === pId) return;
    this.limpiarSuscripcionesLocales();
    this.currentLocalId = pId;
    if (this.socialClient.connected) this.resuscribirSocial(pId);
    if (this.engineClient.connected) this.resuscribirLive(pId);
  }

  private resuscribirSocial(pId: string) {
    this.localSubscriptions.push(this.socialClient.subscribe(`/topic/form-presence/${pId}`, (msg) => {
       this.handlePresence(JSON.parse(msg.body), pId);
    }));
    this.localSubscriptions.push(this.socialClient.subscribe(`/topic/form-sync/${pId}`, (msg) => this.schemaSyncSubject.next(JSON.parse(msg.body))));
    
    // SUSCRIPCIÓN PARA RESALTADO DE IA (2DO PARCIAL)
    this.localSubscriptions.push(this.socialClient.subscribe(`/topic/ai-highlight/${pId}`, (msg) => {
        this.aiHighlightSubject.next(JSON.parse(msg.body));
    }));
  }

  private handlePresence(data: any, pId: string) {
    if (data.sessionId === this.sessionId) return;
    
    let current = [...this.cursorsSubject.value];
    const idx = current.findIndex(c => c.sessionId === data.sessionId);
    
    if (data.action === 'leave') {
      this.cursorsSubject.next(current.filter(c => c.sessionId !== data.sessionId));
      return;
    }

    if (idx > -1) {
      current[idx].x = data.x;
      current[idx].y = data.y;
      if (data.userName) current[idx].userName = data.userName;
      if (data.color) current[idx].color = data.color;
      this.cursorsSubject.next(current);
    } else {
      current.push(data);
      this.cursorsSubject.next(current);
    }
  }

  private resuscribirLive(pId: string) {
    this.localSubscriptions.push(this.engineClient.subscribe(`/topic/politica/${pId}/movimientos`, (msg) => this.diagramMoveSyncSubject.next(JSON.parse(msg.body))));
    this.localSubscriptions.push(this.engineClient.subscribe(`/topic/politica/${pId}`, (msg) => this.diagramSyncSubject.next(JSON.parse(msg.body))));
  }

  enviarActividadGlobal(activity: string, icon: string, action: string = 'active', pId: string | null = null, isHeartbeat: boolean = false) {
    if (!this.socialClient.connected) return;
    const email = this.authService.getEmail();
    if (!email || email === '') return;

    this.currentActivity = activity;
    this.currentIcon = icon;

    const payload: any = { 
      userId: email, 
      sessionId: this.sessionId, 
      userName: this.authService.getNombreCompleto(), 
      politicaId: pId, 
      activity, 
      timestamp: Date.now(), 
      action,
      color: this.userColor
    };

    // ELIMINADO: Ya no se envía el avatar por WebSocket para ahorrar banda.
    // El sistema lo recuperará de la base de datos o usará iniciales.

    this.socialClient.publish({ destination: '/app/global-presence', body: JSON.stringify(payload) });
  }

  conectarGlobal() {
    if (this.socialClient.connected) {
      this.enviarActividadGlobal('En línea', 'sensors', 'join', null);
    }
  }

  enviarMovimiento(pId: string, x: number, y: number) {
    if (this.socialClient.connected) {
      this.socialClient.publish({ 
        destination: `/app/form-presence/${pId}`, 
        body: JSON.stringify({ 
          userId: this.authService.getEmail(), 
          sessionId: this.sessionId, 
          userName: this.authService.getNombreCompleto(), 
          color: this.userColor, 
          x, y, 
          action: 'move' 
        })
      });
    }
  }

  enviarMovimientoNodo(pId: string, data: { key: string, loc?: string, text?: string }) {
    if (this.engineClient.connected) {
        this.engineClient.publish({ destination: `/app/politica/${pId}/mover`, body: JSON.stringify({ ...data, sessionId: this.sessionId }) });
    }
  }

  enviarDiagrama(pId: string, xml: string) {
    if (this.engineClient.connected) {
      this.engineClient.publish({ destination: `/app/politica/${pId}/editar`, body: JSON.stringify({ xml, userName: this.authService.getNombreCompleto(), sessionId: this.sessionId, politicaId: pId, userId: this.authService.getEmail() }) });
    }
  }

  enviarEsquema(pId: string, tId: string, sj: string) {
    if (this.socialClient.connected) {
      this.socialClient.publish({ destination: `/app/form-sync/${pId}`, body: JSON.stringify({ taskId: tId, schema: sj, sessionId: this.sessionId }) });
    }
  }

  enviarMensajePrivado(toId: string, text: string) {
    if (this.socialClient.connected) {
      const msg = { 
        from: this.authService.getNombreCompleto(), 
        fromId: this.authService.getEmail(), 
        content: text, 
        timestamp: Date.now(), 
        toId 
      };
      this.socialClient.publish({ destination: '/app/private-chat', body: JSON.stringify(msg) });
      this.chatMessagesSubject.next([...this.chatMessagesSubject.value, msg].slice(-50));
    }
  }

  private limpiarSuscripcionesLocales() { this.localSubscriptions.forEach(sub => sub.unsubscribe()); this.localSubscriptions = []; }
  
  desconectar(pId: string) { 
    this.currentLocalId = null;
    this.enviarActividadGlobal('En el Menú', 'sensors', 'active', null);
    this.limpiarSuscripcionesLocales(); 
  }

  desconectarGlobal() { 
    this.detenerLatido();
    this.enviarActividadGlobal('Desconectado', 'power_off', 'leave', null); 
  }

  // --- MÉTODOS PARA DOCUMENTO COLABORATIVO (FASE FINAL) ---

  joinDocumentSync(instanciaId: string, callback: (data: any) => void) {
    if (this.socialClient.connected) {
      this.localSubscriptions.push(
        this.socialClient.subscribe(`/topic/doc-sync/${instanciaId}`, (msg) => {
          callback(JSON.parse(msg.body));
        })
      );
    }
  }

  joinDocumentCursors(instanciaId: string, callback: (data: any) => void) {
    if (this.socialClient.connected) {
      this.localSubscriptions.push(
        this.socialClient.subscribe(`/topic/doc-cursors/${instanciaId}`, (msg) => {
          callback(JSON.parse(msg.body));
        })
      );
    }
  }

  sendDocumentContent(instanciaId: string, content: string, sender: string) {
    if (this.socialClient.connected) {
      this.socialClient.publish({
        destination: `/app/doc-sync/${instanciaId}`,
        body: JSON.stringify({ content, sender })
      });
    }
  }

  sendDocumentCursor(instanciaId: string, data: {x: number, y: number, name: string, sender: string, avatar?: string}) {
    if (this.socialClient.connected) {
      this.socialClient.publish({
        destination: `/app/doc-cursors/${instanciaId}`,
        body: JSON.stringify(data)
      });
    }
  }
}
