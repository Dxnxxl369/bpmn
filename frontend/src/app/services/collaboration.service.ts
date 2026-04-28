import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import * as SockJSModule from 'sockjs-client';
const SockJSClass = (SockJSModule as any).default || SockJSModule;

export interface CursorPosition {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  sessionId: string;
}

export interface ChatMessage {
  from: string;
  fromId: string;
  content: string;
  color: string;
  timestamp: number;
  toId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CollaborationService {
  private stompClient: Client;
  public sessionId: string; 
  private currentLocalId: string | null = null;
  private localSubscriptions: any[] = [];
  
  private globalPresenceSubject = new BehaviorSubject<any[]>([]);
  globalPresence$ = this.globalPresenceSubject.asObservable();

  private chatMessagesSubject: BehaviorSubject<ChatMessage[]>;
  chatMessages$: Observable<ChatMessage[]>;

  private cursorsSubject = new BehaviorSubject<CursorPosition[]>([]);
  cursors$ = this.cursorsSubject.asObservable();

  private schemaSyncSubject = new BehaviorSubject<any | null>(null);
  schemaSync$ = this.schemaSyncSubject.asObservable();

  private diagramSyncSubject = new BehaviorSubject<any | null>(null);
  diagramSync$ = this.diagramSyncSubject.asObservable();

  private userColor: string;
  private colors = ['#ff6b13', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#eab308'];

  constructor(private authService: AuthService) {
    this.sessionId = Math.random().toString(36).substring(2, 15);
    this.userColor = this.colors[Math.floor(Math.random() * this.colors.length)];

    const saved = localStorage.getItem('bpms_social_chat');
    let initialHistory: ChatMessage[] = [];
    if (saved) {
      try {
        initialHistory = JSON.parse(saved);
      } catch(e) { localStorage.removeItem('bpms_social_chat'); }
    }

    this.chatMessagesSubject = new BehaviorSubject<ChatMessage[]>(initialHistory);
    this.chatMessages$ = this.chatMessagesSubject.asObservable();

    const serverIp = window.location.hostname;
    this.stompClient = new Client({
      webSocketFactory: () => new SockJSClass(`http://${serverIp}:8080/ws-bpms`),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log("✅ [WS] Conectado exitosamente al servidor");
        if (this.currentLocalId) this.suscribirLocal(this.currentLocalId);
        // Podrías llamar a suscribirGlobal aquí si es necesario
      },
      onStompError: (frame) => {
        console.error("❌ [WS] Error de STOMP:", frame.headers['message']);
      }
    });
    this.stompClient.activate();
  }

  conectarGlobal() {
    if (this.stompClient.connected) this.suscribirGlobal();
    else this.stompClient.onConnect = (frame) => {
      console.log("✅ [WS] Conectado exitosamente al servidor");
      this.suscribirGlobal();
      if (this.currentLocalId) this.suscribirLocal(this.currentLocalId);
    };
  }

  private heartbeatInterval: any;
  private ultimaActividad: any = null;

  enviarActividadGlobal(activity: string, icon: string, action: string = 'active', politicaId: string | null = null) {
    const email = this.authService.getEmail();
    if (!email) return;

    this.ultimaActividad = {
      userId: email,
      sessionId: this.sessionId,
      userName: this.authService.getNombre(),
      avatar: this.authService.getAvatar(),
      color: this.userColor,
      politicaId: politicaId,
      activity: activity,
      timestamp: Date.now(),
      action
    };

    if (this.stompClient?.connected) {
      this.stompClient.publish({ destination: '/app/global-presence', body: JSON.stringify(this.ultimaActividad) });
    }
  }

  private suscribirGlobal() {
    const myEmail = this.authService.getEmail();
    this.stompClient.subscribe('/topic/global-presence', (msg: IMessage) => {
      this.globalPresenceSubject.next(JSON.parse(msg.body));
    });
    this.stompClient.subscribe('/topic/global-chat', (msg: IMessage) => {
      this.handleChatMessage(JSON.parse(msg.body));
    });
    if (myEmail) {
      this.stompClient.subscribe(`/topic/chat/${myEmail}`, (msg: IMessage) => {
        this.handleChatMessage(JSON.parse(msg.body));
      });
    }

    this.startHeartbeat();

    if (this.ultimaActividad) {
      this.enviarActividadGlobal(this.ultimaActividad.activity, 'sensors', 'active', this.ultimaActividad.politicaId);
    } else {
      this.enviarActividadGlobal('En línea', 'sensors');
    }
  }

  enviarMensajeGlobal(text: string) {
    if (this.stompClient.connected) {
      const msg: ChatMessage = { from: this.authService.getNombre() || 'Admin', fromId: this.authService.getEmail() || 'anon', content: text, color: this.userColor, timestamp: Date.now() };
      this.stompClient.publish({ destination: '/app/global-chat', body: JSON.stringify(msg) });
    }
  }

  enviarMensajePrivado(toId: string, text: string) {
    if (this.stompClient.connected) {
      const msg: ChatMessage = { from: this.authService.getNombre() || 'Admin', fromId: this.authService.getEmail() || 'anon', content: text, color: this.userColor, timestamp: Date.now(), toId: toId };
      this.stompClient.publish({ destination: '/app/private-chat', body: JSON.stringify(msg) });
      this.handleChatMessage(msg);
    }
  }

  private handleChatMessage(msg: ChatMessage) {
    const current = this.chatMessagesSubject.value;
    const updated = [...current, msg].slice(-50);
    this.chatMessagesSubject.next(updated);
    localStorage.setItem('bpms_social_chat', JSON.stringify(updated));
  }

  limpiarHistorialSesion() { localStorage.removeItem('bpms_social_chat'); this.chatMessagesSubject.next([]); }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.stompClient?.connected && this.ultimaActividad) {
        this.ultimaActividad.timestamp = Date.now();
        this.stompClient.publish({ destination: '/app/global-presence', body: JSON.stringify(this.ultimaActividad) });
      }
    }, 20000);
  }

  desconectarGlobal() { 
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.enviarActividadGlobal('Desconectado', 'power_off', 'leave'); 
  }

  conectar(politicaId: string) {
    if (this.currentLocalId === politicaId && this.stompClient.connected) return;
    
    console.log("🔄 [WS] Solicitando conexión para política:", politicaId);
    this.limpiarSuscripcionesLocales();
    this.currentLocalId = politicaId;
    this.cursorsSubject.next([]);
    this.diagramSyncSubject.next(null); 
    
    if (this.stompClient.connected) {
      this.suscribirLocal(politicaId);
    }
    // Si no está conectado, el callback onConnect del constructor se encargará
  }

  private limpiarSuscripcionesLocales() {
    this.localSubscriptions.forEach(sub => sub.unsubscribe());
    this.localSubscriptions = [];
  }

  private suscribirLocal(politicaId: string) {
    this.localSubscriptions.push(this.stompClient.subscribe(`/topic/form-presence/${politicaId}`, (msg: IMessage) => {
      this.handlePresence(JSON.parse(msg.body), politicaId);
    }));
    this.localSubscriptions.push(this.stompClient.subscribe(`/topic/form-sync/${politicaId}`, (msg: IMessage) => {
        this.schemaSyncSubject.next(JSON.parse(msg.body));
    }));
    this.localSubscriptions.push(this.stompClient.subscribe(`/topic/politica/${politicaId}`, (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        console.log("📢 Recibida actualización de diagrama para:", politicaId);
        this.diagramSyncSubject.next(data);
    }));
    this.enviarPresencia(politicaId, 0, 0, 'join');
  }

  desconectar(politicaId: string) { 
    this.enviarPresencia(politicaId, 0, 0, 'leave'); 
    this.limpiarSuscripcionesLocales();
    this.currentLocalId = null;
  }
  
  enviarMovimiento(politicaId: string, x: number, y: number) { this.enviarPresencia(politicaId, x, y, 'move'); }

  private enviarPresencia(politicaId: string, x: number, y: number, action: string) {
    if (!this.stompClient.connected) return;
    const isMove = action === 'move';
    const payload = isMove ? 
      { sessionId: this.sessionId, x, y, action } : 
      { userId: this.authService.getEmail(), sessionId: this.sessionId, userName: this.authService.getNombre(), color: this.userColor, x, y, action };
    
    this.stompClient.publish({ 
      destination: `/app/form-presence/${politicaId}`, 
      body: JSON.stringify(payload)
    });
  }

  private handlePresence(data: any, politicaId: string) {
    if (data.sessionId === this.sessionId) return;
    if (data.action === 'join') { this.enviarPresencia(politicaId, 0, 0, 'move'); }
    let current = [...this.cursorsSubject.value];
    const idx = current.findIndex(c => c.sessionId === data.sessionId);
    if (data.action === 'leave') { this.cursorsSubject.next(current.filter(c => c.sessionId !== data.sessionId)); return; }
    if (idx > -1) {
      current[idx].x = data.x; current[idx].y = data.y;
      if (data.userName) current[idx].userName = data.userName;
      if (data.color) current[idx].color = data.color;
      this.cursorsSubject.next(current);
    } else if (data.action === 'join' || data.action === 'move') {
      current.push(data); this.cursorsSubject.next(current);
    }
  }

  enviarEsquema(politicaId: string, taskId: string, schemaJson: string) {
    if (this.stompClient.connected) {
      const payload = JSON.stringify({ taskId, schema: schemaJson });
      this.stompClient.publish({ destination: `/app/form-sync/${politicaId}`, body: payload });
    }
  }

  enviarDiagrama(politicaId: string, xml: string) {
    if (this.stompClient?.connected) {
      const payload = { 
        xml: xml, 
        senderId: this.authService.getEmail(), 
        sessionId: this.sessionId,
        politicaId: politicaId 
      };
      this.stompClient.publish({ destination: `/app/politica/${politicaId}/editar`, body: JSON.stringify(payload) });
    }
  }
}
