import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollaborationService, CursorPosition } from '../../services/collaboration.service';
import { Subscription } from 'rxjs';
import * as go from 'gojs';

@Component({
  selector: 'app-collaborative-cursors',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cursors-overlay">
      <div *ngFor="let cursor of otherCursors" 
           class="collaborative-cursor"
           [style.transform]="getTransform(cursor)"
           [style.color]="cursor.color">
        
        <div class="cursor-visual-pro">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.64 2l-.1.1v17.92l4.82-4.81h8.14L5.64 2z" />
            </svg>
            
            <div class="cursor-tag-pro" [style.background-color]="cursor.color">
                <span class="cursor-name-pro">{{ cursor.userName }}</span>
            </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cursors-overlay {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      z-index: 100000;
      overflow: hidden;
    }
    .collaborative-cursor {
      position: absolute;
      top: 0; left: 0;
      transition: transform 0.08s linear;
      pointer-events: none;
      will-change: transform;
    }
    .cursor-visual-pro { display: flex; flex-direction: column; align-items: flex-start; position: relative; }
    .cursor-tag-pro {
        display: flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 50px;
        margin-top: -2px; margin-left: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.2); animation: popIn 0.2s ease-out;
    }
    .mini-avatar-cursor { width: 16px; height: 16px; border-radius: 50%; background-size: cover; background-position: center; border: 1.5px solid white; background-color: #333; }
    .cursor-name-pro { color: white; font-size: 10px; font-weight: 800; white-space: nowrap; }
    @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
  `]
})
export class CollaborativeCursorsComponent implements OnInit, OnDestroy {
  otherCursors: CursorPosition[] = [];
  private diagram: go.Diagram | null = null;
  private sub = new Subscription();

  constructor(private collabService: CollaborationService) {}

  ngOnInit() {
    this.sub.add(this.collabService.cursors$.subscribe(cursors => {
      this.otherCursors = cursors;
    }));

    // Obtener el diagrama activo para transformar coordenadas
    this.sub.add((this.collabService as any).activeDiagram$.subscribe((diag: any) => {
        this.diagram = diag;
    }));
  }

  getTransform(cursor: CursorPosition): string {
    if (!this.diagram) return `translate(${cursor.x}px, ${cursor.y}px)`;
    
    // Transformar coordenadas de DOCUMENTO (recibidas) a VIEWPORT (locales)
    const docPoint = new go.Point(cursor.x, cursor.y);
    const viewPoint = this.diagram.transformDocToView(docPoint);
    
    return `translate(${viewPoint.x}px, ${viewPoint.y}px)`;
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}
