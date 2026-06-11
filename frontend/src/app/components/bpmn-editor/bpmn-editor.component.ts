import { Component, ElementRef, Input, OnInit, ViewChild, OnDestroy, AfterViewInit, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import * as go from 'gojs';
import { PoliticaNegocio } from '../../services/bpms.service';
import { CollaborationService } from '../../services/collaboration.service';
import { Subscription } from 'rxjs';

import { CollaborativeCursorsComponent } from '../collaborative-cursors/collaborative-cursors.component';

import { FormsModule } from '@angular/forms';

const LANE_WIDTH = 420, HEADER_H = 52, NODE_W = 180, NODE_H = 64, DECISION_SIZE = 80, CIRCLE_SIZE = 40, Y_STEP = 130;

@Component({
  selector: 'app-bpmn-editor', standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CollaborativeCursorsComponent],
  template: `
    <div class="bpmn-root" [class.read-only-mode]="isReadOnly">
      <div class="bpmn-canvas-wrap">
        <div #diagramDiv class="bpmn-canvas"></div>
        <app-collaborative-cursors></app-collaborative-cursors>
      </div>
      <div class="capsule-banner" *ngIf="isReadOnly"><mat-icon>history</mat-icon><span>MODO LECTURA: VIENDO VERSIÓN ANTIGUA</span></div>
      <div class="bpmn-props-bar" *ngIf="selectedInfo && !isReadOnly">
        <div class="props-content">
          <span class="props-badge" [class.is-lane]="selectedInfo.type === 'Calle'">{{ selectedInfo.type }}</span>
          <span class="props-name">{{ selectedInfo.name || '(sin nombre)' }}</span>
          
          <label class="premium-toggle" *ngIf="selectedInfo.type === 'Calle'">
            <input type="checkbox" [ngModel]="selectedInfo.isExternal" (ngModelChange)="toggleExternalLane($event)" hidden>
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
            <span class="toggle-label">ACTOR EXTERNO (CLIENTE)</span>
          </label>
        </div>
        <button class="props-del-btn" (click)="deleteSelected()"><mat-icon>delete_outline</mat-icon> BORRAR</button>
      </div>
    </div>`,
  styles: [`.bpmn-root { display: flex; flex-direction: column; width: 100%; height: 100%; flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; position: relative; font-family: 'Inter', sans-serif; } .bpmn-canvas-wrap { position: relative; flex: 1; width: 100%; height: 100%; background: #fdfdfd; min-height: 500px; overflow: hidden; } .bpmn-canvas { width: 100%; height: 100%; outline: none; background: #f8fafc; cursor: default; } .bpmn-props-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: #fff; border-top: 1px solid #e2e8f0; flex-shrink: 0; } .props-content { display: flex; align-items: center; gap: 16px; } .props-badge { font-size: 10px; font-weight: 800; color: #4f46e5; text-transform: uppercase; background: #eef2ff; padding: 4px 12px; border-radius: 20px; } .props-badge.is-lane { color: #0f172a; background: #f1f5f9; } .props-name { font-size: 15px; color: #1e293b; font-weight: 600; } .props-del-btn { display: flex; align-items: center; gap: 8px; background: #fff1f2; border: 1px solid #fecaca; cursor: pointer; color: #ef4444; padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: 700; transition: 0.2s; } .props-del-btn:hover { background: #ef4444; color: white; border-color: #ef4444; } .read-only-mode .bpmn-canvas { filter: grayscale(0.2); } .capsule-banner { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 10px 25px; border-radius: 50px; display: flex; align-items: center; gap: 12px; font-size: 11px; font-weight: 800; letter-spacing: 1px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 100; border: 1px solid #4f46e5; } .premium-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; margin-left: 20px; } .toggle-track { width: 34px; height: 18px; background: #e2e8f0; border-radius: 20px; position: relative; transition: 0.4s; } .toggle-thumb { width: 12px; height: 12px; background: #fff; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: 0.4s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); } .premium-toggle input:checked ~ .toggle-track { background: #10b981; } .premium-toggle input:checked ~ .toggle-track .toggle-thumb { left: 19px; } .toggle-label { font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; } .premium-toggle input:checked ~ .toggle-label { color: #10b981; }`]
})
export class BpmnEditorComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @ViewChild('diagramDiv', { static: true }) private diagramDiv!: ElementRef;
  private _politica?: PoliticaNegocio;
  @Input() set politica(val: PoliticaNegocio | undefined) {
    if (!val) { this._politica = val; return; }
    const oldXml = this._politica?.xmlBpmn;
    this._politica = val;
    if (this.diagram && val.xmlBpmn && val.xmlBpmn !== oldXml) {
      this.loadUmlFromXml(val.xmlBpmn);
    }
    if (val.id) this.collabService.conectar(val.id);
  }
  get politica(): PoliticaNegocio | undefined { return this._politica; }
  @Input() isReadOnly: boolean = false;
  public diagram!: go.Diagram;
  selectedInfo: { key: string; type: string; name: string; isExternal?: boolean } | null = null;
  private isRemoteUpdate = false;
  private debounceTimer: any;
  private subs = new Subscription();
  private lastMouseMoveTime = 0;

  constructor(private cdr: ChangeDetectorRef, private collabService: CollaborationService) { }

  ngOnChanges(changes: SimpleChanges) {
    if (this.diagram && changes['isReadOnly']) {
      this.applyReadOnlySettings();
    }
  }

  private applyReadOnlySettings() {
    if (!this.diagram) return;
    this.diagram.isReadOnly = this.isReadOnly;
    this.diagram.allowDelete = !this.isReadOnly;
    this.diagram.allowLink = !this.isReadOnly;
    this.diagram.allowMove = !this.isReadOnly;
    this.diagram.allowInsert = !this.isReadOnly;
    this.diagram.allowRelink = !this.isReadOnly;
    this.diagram.allowUndo = !this.isReadOnly;
    this.diagram.allowDrop = !this.isReadOnly;
    this.diagram.allowZoom = true;
    this.diagram.allowHorizontalScroll = true;
    this.diagram.allowVerticalScroll = true;
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.subs.add(this.collabService.diagramMoveSync$.subscribe(move => {
      if (!this.diagram || this.isReadOnly || move.sessionId === this.collabService.sessionId) return;
      const part = this.diagram.findPartForKey(move.key);
      if (part) {
        this.isRemoteUpdate = true;
        this.diagram.commit(d => {
          if (move.loc) {
            const newLoc = (typeof move.loc === 'string') ? go.Point.parse(move.loc) : move.loc;
            d.model.setDataProperty(part.data, "loc", go.Point.stringify(newLoc));
          }
          if (move.text !== undefined) {
            d.model.setDataProperty(part.data, "name", move.text);
          }
        }, "remote move");
        this.isRemoteUpdate = false;
      }
    }));

    this.subs.add(this.collabService.diagramSync$.subscribe(data => {
      if (data && data.sessionId !== this.collabService.sessionId && !this.isReadOnly) {
        this.loadUmlFromXml(data.xml);
      }
    }));
  }

  ngAfterViewInit() {
    this.initDiagram();
    new ResizeObserver(() => { if (this.diagram) this.diagram.requestUpdate(); }).observe(this.diagramDiv.nativeElement);
    setTimeout(() => { if (this.politica?.xmlBpmn) this.loadUmlFromXml(this.politica.xmlBpmn); }, 500);
  }

  private initDiagram(): void {
    const $ = go.GraphObject.make;
    this.diagram = new go.Diagram(this.diagramDiv.nativeElement, {
      "undoManager.isEnabled": !this.isReadOnly, initialContentAlignment: go.Spot.Center,
      "toolManager.mouseWheelBehavior": go.ToolManager.WheelZoom, padding: 100,
      scrollMode: go.Diagram.DocumentScroll,
      "draggingTool.isGridSnapEnabled": true, "animationManager.isEnabled": false,
      isReadOnly: this.isReadOnly,
      allowDelete: !this.isReadOnly,
      allowLink: !this.isReadOnly,
      allowMove: !this.isReadOnly,
      allowDrop: !this.isReadOnly,
      allowSelect: !this.isReadOnly
    });

    // Panning con rueda del ratón (Click Central)
    if (this.diagram.toolManager.panningTool) {
      this.diagram.toolManager.panningTool.isEnabled = true;
      (this.diagram.toolManager.panningTool as any).button = 2; // Middle button
    }

    const makePort = (name: string, spot: go.Spot) => {
      return $(go.Shape, "Circle", {
        fill: "#d35400", stroke: "white", strokeWidth: 1.5,
        desiredSize: new go.Size(12, 12),
        portId: name, fromSpot: spot, toSpot: spot,
        fromLinkable: true, toLinkable: true,
        cursor: "crosshair", alignment: spot,
        opacity: 0,
        "_isPort": true,
        mouseEnter: (e: any, obj: any) => { if (!this.isReadOnly) obj.opacity = 1; },
        mouseLeave: (e: any, obj: any) => { obj.opacity = 0; }
        });
    };

    const nodeSelectionAdornmentTemplate =
      $(go.Adornment, "Spot",
        $(go.Placeholder),
        $(go.Shape, "Circle", { alignment: go.Spot.TopLeft, cursor: "nw-resize", desiredSize: new go.Size(10, 10), fill: "white", stroke: "#4f46e5", strokeWidth: 2 }),
        $(go.Shape, "Circle", { alignment: go.Spot.TopRight, cursor: "ne-resize", desiredSize: new go.Size(10, 10), fill: "white", stroke: "#4f46e5", strokeWidth: 2 }),
        $(go.Shape, "Circle", { alignment: go.Spot.BottomLeft, cursor: "sw-resize", desiredSize: new go.Size(10, 10), fill: "white", stroke: "#4f46e5", strokeWidth: 2 }),
        $(go.Shape, "Circle", { alignment: go.Spot.BottomRight, cursor: "se-resize", desiredSize: new go.Size(10, 10), fill: "white", stroke: "#4f46e5", strokeWidth: 2 })
      );

    // CONFIGURACIÓN ESPECIAL PARA LECTURA (CÁPSULA)
    if (this.isReadOnly) {
      this.diagram.toolManager.panningTool.isEnabled = true;
      this.diagram.toolManager.draggingTool.isEnabled = false;
      this.diagram.toolManager.textEditingTool.isEnabled = false;
      this.diagram.toolManager.clickCreatingTool.isEnabled = false;
      this.diagram.toolManager.actionTool.isEnabled = false;
      this.diagram.toolManager.linkingTool.isEnabled = false;
    }

    (this.collabService as any).activeDiagramSubject.next(this.diagram);
    this.diagram.addDiagramListener('ChangedSelection', () => { this.updateSelectedInfo(); this.cdr.detectChanges(); });

    this.diagramDiv.nativeElement.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.diagram || this.isReadOnly || !this.politica?.id) return;
      const now = Date.now();
      if (now - this.lastMouseMoveTime < 40) return;
      this.lastMouseMoveTime = now;
      const rect = this.diagram.div!.getBoundingClientRect();
      const docPoint = this.diagram.transformViewToDoc(new go.Point(e.clientX - rect.left, e.clientY - rect.top));
      this.collabService.enviarMovimiento(this.politica.id, docPoint.x, docPoint.y);
    });

    this.diagram.addModelChangedListener((e) => {
      if (this.isRemoteUpdate || this.isReadOnly || !this.politica?.id) return;
      if (e.propertyName === "loc" && e.modelChange === "" && e.object) {
        const now = Date.now();
        if (now - this.lastMouseMoveTime < 30) return;
        this.lastMouseMoveTime = now;
        const part = this.diagram.findPartForData(e.object);
        if (part instanceof go.Node) {
          this.collabService.enviarMovimientoNodo(this.politica.id, {
            key: String(part.key),
            loc: go.Point.stringify(part.location)
          });
        }
      }
      if (e.propertyName === "name" && e.modelChange === "" && e.object) {
        const part = this.diagram.findPartForData(e.object);
        if (part) {
          this.collabService.enviarMovimientoNodo(this.politica.id, {
            key: String(part.key),
            text: (e.object as any).name
          });
        }
      }
    });

    this.diagram.addModelChangedListener((e) => {
      if (this.isRemoteUpdate || this.isReadOnly) return;
      if (e.isTransactionFinished) {
        const tx = e.object as go.Transaction;
        if (tx && tx.name !== "remote move" && tx.name !== "Initial Layout" && tx.name !== "layout") {
          this.scheduleAutoSave();
        }
      }
    });

    this.diagram.groupTemplate = $(go.Group, "Vertical",
      {
        selectionObjectName: "SHAPE", locationSpot: go.Spot.TopLeft,
        resizable: false, movable: true, copyable: false,
        layerName: "Background", // SOLUCIÓN: Z-Index. Las calles siempre al fondo.
        layout: null, computesBoundsAfterDrag: true, computesBoundsIncludingLinks: false,
        handlesDragDropForMembers: true,
        mouseDrop: (e, grp) => { 
          // Solo reordenar si lo que soltamos fue una calle entera (Group)
          const isLane = e.diagram.selection.first() instanceof go.Group;
          if (isLane) {
            this.reordenarCalles(); 
          }
        },
        // Asegura que si un nodo cae dentro del perímetro de la calle, sea adoptado sin rebotar.
        mouseDragEnter: (e, grp, prev) => {
           let group = grp as go.Group;
           let shape = group.findObject("SHAPE") as go.Shape;
           if (shape) shape.stroke = "#f59e0b"; // Feedback visual (borde naranja)
        },
        mouseDragLeave: (e, grp, next) => {
           let group = grp as go.Group;
           let shape = group.findObject("SHAPE") as go.Shape;
           if (shape) shape.stroke = "#cbd5e1"; // Restaurar color original
        }
      },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Panel, "Auto",
        { stretch: go.GraphObject.Horizontal, height: HEADER_H },
        $(go.Shape, "Rectangle", { fill: "#1e293b", stroke: null }),
        $(go.TextBlock,
          { margin: 10, font: "bold 12pt Inter", stroke: "white", textAlign: "center", verticalAlignment: go.Spot.Center, editable: true },
          new go.Binding("text", "name").makeTwoWay())
      ),
      $(go.Shape, "Rectangle",
        { name: "SHAPE", fill: "#f8fafc", stroke: "#cbd5e1", strokeWidth: 2, width: LANE_WIDTH, height: 1000 },
        new go.Binding("fill", "color"))
    );

    this.diagram.nodeTemplate = $(go.Node, "Spot",
      { 
        locationSpot: go.Spot.Center, resizable: true, resizeObjectName: "BOD",
        selectionAdornmentTemplate: nodeSelectionAdornmentTemplate 
      },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Panel, "Auto",
        $(go.Shape, "RoundedRectangle", {
          name: "BOD", fill: "white", stroke: "#4f46e5", strokeWidth: 2.5,
          minSize: new go.Size(NODE_W, NODE_H), cursor: "move"
        }),
        $(go.TextBlock, { margin: 15, font: "600 11pt Inter", textAlign: "center", editable: true },
          new go.Binding("text", "name").makeTwoWay())
      ),
      makePort("T", go.Spot.Top), makePort("B", go.Spot.Bottom),
      makePort("L", go.Spot.Left), makePort("R", go.Spot.Right)
    );

    this.diagram.nodeTemplateMap.add("DecisionNode", $(go.Node, "Spot",
      { 
        locationSpot: go.Spot.Center, resizable: true, resizeObjectName: "BOD",
        selectionAdornmentTemplate: nodeSelectionAdornmentTemplate 
      },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Panel, "Auto",
        $(go.Shape, "Diamond", {
          name: "BOD", width: DECISION_SIZE, height: DECISION_SIZE, fill: "#fffbeb", stroke: "#f59e0b", strokeWidth: 2.5, cursor: "move"
        }),
        $(go.TextBlock, { font: "bold 9.5pt Inter", stroke: "#92400e", editable: true, textAlign: "center", width: 75 },
          new go.Binding("text", "name").makeTwoWay())
      ),
      makePort("T", go.Spot.Top), makePort("B", go.Spot.Bottom),
      makePort("L", go.Spot.Left), makePort("R", go.Spot.Right)
    ));

    this.diagram.nodeTemplateMap.add("InitialNode", $(go.Node, "Spot",
      { locationSpot: go.Spot.Center },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Shape, "Circle", {
        width: CIRCLE_SIZE, height: CIRCLE_SIZE, fill: "#10b981", stroke: null, cursor: "move"
      }),
      makePort("T", go.Spot.Top), makePort("B", go.Spot.Bottom),
      makePort("L", go.Spot.Left), makePort("R", go.Spot.Right)
    ));

    this.diagram.nodeTemplateMap.add("ActivityFinalNode", $(go.Node, "Spot",
      { locationSpot: go.Spot.Center },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Shape, "Circle", {
        width: CIRCLE_SIZE, height: CIRCLE_SIZE, fill: "#ef4444", stroke: null, cursor: "move"
      }),
      makePort("T", go.Spot.Top), makePort("B", go.Spot.Bottom),
      makePort("L", go.Spot.Left), makePort("R", go.Spot.Right)
    ));

    this.diagram.nodeTemplateMap.add("ForkNode", $(go.Node, "Spot",
      { locationSpot: go.Spot.Center },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Shape, "Rectangle", {
        name: "BOD", fill: "#334155", stroke: null, width: 100, height: 10, cursor: "move"
      }),
      makePort("T", go.Spot.Top), makePort("B", go.Spot.Bottom),
      makePort("L", go.Spot.Left), makePort("R", go.Spot.Right)
    ));

    this.diagram.linkTemplate = $(go.Link, { routing: go.Link.AvoidsNodes, curve: go.Link.JumpOver, corner: 20, relinkableFrom: true, relinkableTo: true }, $(go.Shape, { stroke: "#64748b", strokeWidth: 2.5 }), $(go.Shape, { toArrow: "Standard", fill: "#64748b", stroke: null, scale: 1.5 }), $(go.Panel, "Auto", { _isLinkLabel: true }, $(go.Shape, "RoundedRectangle", { fill: "#f1f5f9", stroke: "#cbd5e1", strokeWidth: 1 }), $(go.TextBlock, "Opción", { name: "LABEL", margin: 6, font: "bold 10pt Inter", stroke: "#4f46e5", editable: true, minSize: new go.Size(40, 20), textAlign: "center" }, new go.Binding("text", "name").makeTwoWay())));
  }

  private reordenarCalles() {
    if (!this.diagram) return;
    this.diagram.commit(d => {
      const groups: go.Group[] = [];
      const it = d.findTopLevelGroups();
      while (it.next()) { groups.push(it.value); }
      groups.sort((a, b) => a.location.x - b.location.x);
      groups.forEach((grp, idx) => {
        const newX = idx * LANE_WIDTH;
        d.model.setDataProperty(grp.data, "loc", `${newX} 0`);
      });
    }, "reorder lanes");
    this.scheduleAutoSave();
  }

  public updateRemote(xml: string) { if (!xml) return; this.loadUmlFromXml(xml); }

  private loadUmlFromXml(xml: string): void {
    if (!xml || !this.diagram) return;
    try {
      this.isRemoteUpdate = true; 
      const parser = new DOMParser(); 
      const doc = parser.parseFromString(xml, 'text/xml'); 
      const nodes: any[] = []; 
      const links: any[] = []; 
      const laneMap = new Map<string, string>();
      const laneIndexMap = new Map<string, number>();

      const getEls = (tag: string) => { 
        const res: Element[] = []; 
        const all = doc.getElementsByTagName("*"); 
        for (let i = 0; i < all.length; i++) if (all[i].localName === tag) res.push(all[i]); 
        return res; 
      };

      // 1. CARGAR CALLES (LANES)
      getEls('ActivityPartition').forEach((p, i) => { 
        const id = p.getAttribute('id') || `lane_${i}`; 
        const laneX = i * LANE_WIDTH;
        const isExternal = p.getAttribute('isExternal') === 'true';
        nodes.push({ 
            key: id, 
            name: p.getAttribute('name')?.toUpperCase() || "DEPARTAMENTO", 
            isGroup: true, 
            loc: p.getAttribute('loc') || `${laneX} 0`, 
            color: '#f8fafc',
            isExternal: isExternal
        }); 
        laneIndexMap.set(id, i);
        const refs = Array.from(p.childNodes).filter((n: any) => n.localName === 'nodeRef'); 
        refs.forEach((ref: any) => laneMap.set(ref.textContent?.trim() || '', id)); 
      });

      // 2. CARGAR NODOS CON LAYOUT DE CASCADA GLOBAL (Efecto mio.png)
      const TYPES = [
        { t: 'InitialNode', c: 'InitialNode' }, 
        { t: 'OpaqueAction', c: '' }, 
        { t: 'DecisionNode', c: 'DecisionNode' }, 
        { t: 'ForkNode', c: 'ForkNode' },
        { t: 'ActivityFinalNode', c: 'ActivityFinalNode' }
      ];

      let globalY = 100;

      TYPES.forEach(t => { 
        getEls(t.t).forEach(el => { 
          const id = el.getAttribute('id') || `n_${Math.random()}`; 
          const gId = laneMap.get(id);
          let finalLoc = el.getAttribute('loc');
          if (!finalLoc || finalLoc === "0 0" || finalLoc === "0,0") {
              const laneIdx = gId ? (laneIndexMap.get(gId) || 0) : 0;
              const x = (laneIdx * LANE_WIDTH) + (LANE_WIDTH / 2);
              const y = globalY;
              finalLoc = `${x} ${y}`;
              globalY += Y_STEP;
          }
          nodes.push({ key: id, name: el.getAttribute('name') || (t.c === '' ? 'Actividad' : ''), category: t.c, group: gId, loc: finalLoc }); 
        }); 
      });

      getEls('ControlFlow').forEach(f => { links.push({ from: f.getAttribute('sourceRef'), to: f.getAttribute('targetRef'), name: f.getAttribute('name') || "" }); });
      this.diagram.model = new go.GraphLinksModel(nodes, links);
      this.cdr.detectChanges();
      setTimeout(() => this.isRemoteUpdate = false, 300);
    } catch (e) { console.error('UML Engine Error:', e); this.isRemoteUpdate = false; }
  }

  private updateSelectedInfo() { 
    if (!this.diagram) return; 
    const sel = this.diagram.selection.first(); 
    if (!sel) { this.selectedInfo = null; return; } 
    this.selectedInfo = { 
      key: sel.data.key,
      type: sel instanceof go.Group ? 'Calle' : (sel instanceof go.Link ? 'Flujo' : (sel.data.category || 'Acción')), 
      name: (sel.data as any).name || '',
      isExternal: (sel.data as any).isExternal || false
    }; 
  }

  toggleExternalLane(val: boolean) {
    if (!this.diagram || !this.selectedInfo) return;
    const part = this.diagram.findPartForKey(this.selectedInfo.key);
    if (part) {
      this.diagram.commit(d => {
        d.model.setDataProperty(part.data, "isExternal", val);
      }, "toggle external");
      this.selectedInfo.isExternal = val;
      this.scheduleAutoSave();
    }
  }

  addActivity() { if (this.isReadOnly) return; this.diagram.model.addNodeData({ key: 'act_' + Date.now(), name: 'Nueva Acción', loc: go.Point.stringify(this.diagram.viewportBounds.center) }); }
  addDecision() { if (this.isReadOnly) return; this.diagram.model.addNodeData({ key: 'dec_' + Date.now(), name: '¿?', category: 'DecisionNode', loc: go.Point.stringify(this.diagram.viewportBounds.center) }); }
  addStart() { if (this.isReadOnly) return; this.diagram.model.addNodeData({ key: 'start_' + Date.now(), category: 'InitialNode', loc: go.Point.stringify(this.diagram.viewportBounds.center) }); }
  addEnd() { if (this.isReadOnly) return; this.diagram.model.addNodeData({ key: 'end_' + Date.now(), category: 'ActivityFinalNode', loc: go.Point.stringify(this.diagram.viewportBounds.center) }); }
  addFork() { if (this.isReadOnly) return; this.diagram.model.addNodeData({ key: 'fork_' + Date.now(), category: 'ForkNode', loc: go.Point.stringify(this.diagram.viewportBounds.center) }); }
  addLane() { if (this.isReadOnly) return; const x = this.diagram.findTopLevelGroups().count * 420; this.diagram.model.addNodeData({ key: 'lane_' + Date.now(), name: 'NUEVA CALLE', isGroup: true, loc: `${x} 0`, color: '#ffffff', isExternal: false }); }

  zoomIn() { if (this.diagram) this.diagram.commandHandler.increaseZoom(); }
  zoomOut() { if (this.diagram) this.diagram.commandHandler.decreaseZoom(); }
  resetZoom() { if (!this.diagram) return; this.diagram.scale = 1; this.diagram.centerRect(this.diagram.documentBounds); this.diagram.zoomToFit(); }
  undo() { if (this.diagram && !this.isReadOnly) this.diagram.commandHandler.undo(); }
  redo() { if (this.diagram && !this.isReadOnly) this.diagram.commandHandler.redo(); }
  deleteSelected() { if (this.diagram && !this.isReadOnly) this.diagram.commandHandler.deleteSelection(); }

  async saveXML(): Promise<string> {
    if (!this.diagram) return this.politica?.xmlBpmn || ""; const model = this.diagram.model as go.GraphLinksModel; const nodeData = model.nodeDataArray; const linkData = model.linkDataArray; const lanes = nodeData.filter(n => (n as any)['isGroup']).map(n => ({ key: (n as any)['key'], name: (n as any)['name'] || "DEPARTAMENTO", loc: (n as any)['loc'], x: go.Point.parse((n as any)['loc'] || "0 0").x, isExternal: (n as any)['isExternal'] || false })).sort((a, b) => a.x - b.x); const nodes = nodeData.filter(n => !(n as any)['isGroup']); const nodesByLane = new Map<any, any[]>(); lanes.forEach(lane => nodesByLane.set(lane.key, [])); nodes.forEach(node => { const nodeX = go.Point.parse((node as any)['loc'] || "0 0").x; let assignedLane = lanes.find((lane, idx) => { const nextLaneX = lanes[idx + 1] ? lanes[idx + 1].x : Infinity; return nodeX >= lane.x && nodeX < nextLaneX; }) || lanes[0]; if (assignedLane) nodesByLane.get(assignedLane.key)?.push(node); }); let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:uml="http://www.omg.org/spec/UML/20131001">\n  <bpmn:process id="Process_1" isExecutable="false">\n`;
    lanes.forEach(lane => { xml += `    <bpmn:childLaneSet>\n      <bpmn:lane id="${lane.key}" name="${lane.name}">\n        <ActivityPartition id="${lane.key}" name="${lane.name}" loc="${lane.loc || ""}" isExternal="${lane.isExternal ? 'true' : 'false'}">\n`; const laneNodes = nodesByLane.get(lane.key) || []; laneNodes.forEach(n => { xml += `          <nodeRef>${(n as any)['key']}</nodeRef>\n`; }); xml += `        </ActivityPartition>\n      </bpmn:lane>\n    </bpmn:childLaneSet>\n`; });
    nodes.forEach(n => { const nodeObj = n as any; const nodeId = nodeObj['key']; const loc = nodeObj['loc'] || ""; let tag = "OpaqueAction"; if (nodeObj['category'] === "InitialNode") tag = "InitialNode"; else if (nodeObj['category'] === "ActivityFinalNode") tag = "ActivityFinalNode"; else if (nodeObj['category'] === "DecisionNode") tag = "DecisionNode"; else if (nodeObj['category'] === "ForkNode") tag = "ForkNode"; xml += `    <${tag} id="${nodeId}" name="${nodeObj['name'] || ""}" loc="${loc}">\n`; linkData.filter(l => (l as any)['from'] === nodeId).forEach(l => { xml += `      <outgoing>flow_${(l as any)['from']}_${(l as any)['to']}</outgoing>\n`; }); linkData.filter(l => (l as any)['to'] === nodeId).forEach(l => { xml += `      <incoming>flow_${(l as any)['from']}_${(l as any)['to']}</incoming>\n`; }); xml += `    </${tag}>\n`; });
    linkData.forEach(l => { const linkObj = l as any; const flowId = `flow_${linkObj['from']}_${linkObj['to']}`; xml += `    <ControlFlow id="${flowId}" name="${linkObj['name'] || ""}" sourceRef="${linkObj['from']}" targetRef="${linkObj['to']}" />\n`; });
    xml += `  </bpmn:process>\n</bpmn:definitions>`; return xml;
  }
  private scheduleAutoSave() { if (this.debounceTimer) clearTimeout(this.debounceTimer); this.debounceTimer = setTimeout(() => this.broadcastChanges(), 500); }
  private async broadcastChanges() { if (!this.politica?.id || this.isRemoteUpdate || this.isReadOnly) return; const xml = await this.saveXML(); this.collabService.enviarDiagrama(this.politica.id, xml); }
  ngOnDestroy() {
    if (this.diagram) this.diagram.div = null as any;
    this.subs.unsubscribe();
    if (this.politica?.id) {
      this.collabService.enviarActividadGlobal('Salió del editor', 'logout', 'leave', this.politica.id);
      (this.collabService as any).socialClient.publish({
        destination: `/app/form-presence/${this.politica.id}`,
        body: JSON.stringify({ sessionId: this.collabService.sessionId, action: 'leave' })
      });
      this.collabService.desconectar(this.politica.id);
    }
  }
}
