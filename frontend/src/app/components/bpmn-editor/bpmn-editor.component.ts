import { Component, ElementRef, Input, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { PoliticaNegocio, BpmsService } from '../../services/bpms.service';
import { CollaborationService } from '../../services/collaboration.service';
import { AuthService } from '../../services/auth.service';
import { Subscription, debounceTime, Subject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-bpmn-editor',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './bpmn-editor.component.html',
  styleUrls: ['./bpmn-editor.component.css']
})
export class BpmnEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('canvas', { static: true }) private canvasParent!: ElementRef;
  @Input() politica?: PoliticaNegocio;

  private modeler!: any;
  private subs = new Subscription();
  private isImporting = false; 
  private changeSubject = new Subject<string>();
  private lastXmlSent: string = '';
  private lastXmlReceived: string = '';

  constructor(
    private collabService: CollaborationService, 
    private authService: AuthService,
    private bpmsService: BpmsService,
    private snackBar: MatSnackBar
  ) {
    this.modeler = new BpmnModeler({
      keyboard: { bindTo: window }
    });

    // Sincronización optimizada: 500ms y sin formato para reducir peso drasticamente
    this.subs.add(this.changeSubject.pipe(debounceTime(500)).subscribe(async xml => {
      if (this.politica?.id && !this.isImporting && xml !== this.lastXmlSent) {
        console.log("⚡ [WS] Enviando cambio (Peso: " + xml.length + " bytes)");
        this.lastXmlSent = xml;
        this.collabService.enviarDiagrama(this.politica.id, xml);

        this.bpmsService.guardarDiagrama(this.politica.id, xml).subscribe({
          next: () => console.log("💾 [DB] Respaldo completado."),
          error: (err) => console.error("Error al persistir:", err)
        });
      }
    }));
  }

  ngOnInit() {
    // ESCUCHA ACTIVA DE CAMBIOS REMOTOS
    this.subs.add(this.collabService.diagramSync$.subscribe((data: any) => {
      if (!data || !data.xml) return;

      const remoteId = String(data.politicaId);
      const localId = String(this.politica?.id);
      const isFromOther = data.sessionId !== this.collabService.sessionId;

      if (remoteId === localId && isFromOther) {
        // EVITAR RE-IMPORTAR SI ES EL MISMO XML (Crucial para no trabar el navegador)
        if (data.xml === this.lastXmlReceived) return;
        
        this.lastXmlReceived = data.xml;
        console.warn("🔥 [WS] Sincronizando lienzo por cambio remoto...");
        this.importarXML(data.xml, true);
      }
    }));
  }

  ngAfterViewInit() {
    this.modeler.attachTo(this.canvasParent.nativeElement);
    if (this.politica?.xmlBpmn) {
        this.importarXML(this.politica.xmlBpmn);
    } else {
        this.modeler.createDiagram();
    }

    this.modeler.on('commandStack.changed', () => {
        this.notificarCambioLocal();
    });
  }

  private async notificarCambioLocal() {
    if (this.isImporting) return;
    try {
      // format: false para que el XML sea lo más pequeño posible al viajar por socket
      const { xml } = await this.modeler.saveXML({ format: false });
      if (xml) this.changeSubject.next(xml);
    } catch (err) {
      console.error('Error al capturar XML local:', err);
    }
  }

  private async importarXML(xml: string, isRemote: boolean = false) {
    if (isRemote) this.isImporting = true;
    try {
      await this.modeler.importXML(xml);
    } catch (err) {
      console.error('Fallo al importar XML remoto:', err);
    } finally {
      if (isRemote) {
        // Bloqueamos la emisión de cambios locales durante un breve periodo para evitar ecos
        setTimeout(() => { this.isImporting = false; }, 500);
      }
    }
  }

  // Controles del Ribbon
  zoomIn() { this.modeler.get('zoomScroll').stepZoom(1); }
  zoomOut() { this.modeler.get('zoomScroll').stepZoom(-1); }
  resetZoom() { this.modeler.get('canvas').zoom('fit-viewport'); }
  undo() { this.modeler.get('commandStack').undo(); }
  redo() { this.modeler.get('commandStack').redo(); }

  crearElemento(type: string) {
    const create = this.modeler.get('create');
    const elementFactory = this.modeler.get('elementFactory');
    const shape = elementFactory.createShape({ type: type });
    create.start(null, shape);
  }

  activarConector() {
    this.modeler.get('globalConnect').toggle();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.modeler) {
      this.modeler.destroy();
    }
  }
}
