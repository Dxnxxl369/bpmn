import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollaborationService, CursorPosition } from '../../services/collaboration.service';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-collaborative-cursors',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cursors-container" *ngIf="currentPoliticaId">
      <div *ngFor="let cursor of otherCursors" 
           class="collaborative-cursor"
           [style.left.px]="cursor.x"
           [style.top.px]="cursor.y"
           [style.color]="cursor.color">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" [style.filter]="'drop-shadow(0 0 5px ' + cursor.color + ')'">
          <path d="M5.64 2l-.1.1v17.92l4.82-4.81h8.14L5.64 2z" />
        </svg>
        <span class="cursor-label" [style.background-color]="cursor.color">
          {{ cursor.userName }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .cursors-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 999999;
      overflow: hidden;
    }
    .collaborative-cursor {
      position: absolute;
      transition: all 0.08s linear;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      pointer-events: none;
      z-index: 1000;
    }
    .cursor-label {
      padding: 2px 8px;
      border-radius: 4px;
      color: white;
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
      margin-top: 4px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
    }
  `]
})
export class CollaborativeCursorsComponent implements OnInit, OnDestroy {
  otherCursors: CursorPosition[] = [];
  currentPoliticaId: string | null = null;
  private sub = new Subscription();
  private lastUpdate = 0;

  constructor(
    private collabService: CollaborationService, 
    private aiService: AiAssistantService
  ) {}

  ngOnInit() {
    // Sincronizar con el contexto de IA para saber en qué política estamos
    this.sub.add(this.aiService.currentContext$.subscribe(ctx => {
      const newId = ctx.id || null;
      
      if (this.currentPoliticaId && this.currentPoliticaId !== newId) {
        this.collabService.desconectar(this.currentPoliticaId);
        this.otherCursors = [];
      }

      this.currentPoliticaId = newId;

      if (this.currentPoliticaId) {
        this.collabService.conectar(this.currentPoliticaId);
      }
    }));

    this.sub.add(this.collabService.cursors$.subscribe(cursors => {
      this.otherCursors = cursors;
    }));
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.currentPoliticaId) return;

    const now = Date.now();
    if (now - this.lastUpdate > 40) { // 25 FPS para mayor fluidez
      this.collabService.enviarMovimiento(this.currentPoliticaId, event.clientX, event.clientY);
      this.lastUpdate = now;
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    if (this.currentPoliticaId) {
      this.collabService.desconectar(this.currentPoliticaId);
    }
  }
}
