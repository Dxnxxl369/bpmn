import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { BpmsService } from '../../services/bpms.service';
import { CollaborationService } from '../../services/collaboration.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css']
})
export class DocumentEditorComponent implements OnInit, OnDestroy, OnChanges {
  @Input() instanciaId!: string;
  @Input() tareaId!: string;
  @Input() contextoJson: any = {}; // LIVE JSON FROM FORM
  @Input() instancia: any = null; // FULL INSTANCE CONTEXT
  @Input() selectedDocument: any = null; 
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('docBody') docBody!: ElementRef;

  isGenerating = false;
  isDraftingIA = false;
  iaPrompt: string = '';
  content: string = '';
  
  me: any;
  collaborators: any[] = [];
  remoteCursors: { [id: string]: any } = {};

  // GESTIÓN DE VERSIONES Y MODO CÁPSULA
  isCapsuleMode: boolean = false;
  showVersionsSidebar: boolean = false;
  showIaActions: boolean = false;
  versiones: any[] = [];
  viewingVersion: any = null;

  private cursorSyncInterval: any;

  constructor(
    private bpmsService: BpmsService,
    private collabService: CollaborationService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => this.me = user);
    this.loadDocumentData();
    this.setupCollaboration();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedDocument'] && !changes['selectedDocument']?.firstChange) {
      this.loadDocumentData();
      if (this.showVersionsSidebar) {
        this.versiones = [];
        this.loadVersions();
      }
    }
  }

  private loadDocumentData() {
    if (this.selectedDocument && this.selectedDocument.contenidoHtml) {
      this.content = this.selectedDocument.contenidoHtml;
      if (this.docBody) this.docBody.nativeElement.innerHTML = this.content;
    } else {
      this.initDefaultContent();
    }
    this.isCapsuleMode = false;
    this.viewingVersion = null;
    this.cdr.detectChanges();
  }

  generarBorradorIA() {
    if (!this.iaPrompt.trim()) return;
    this.isDraftingIA = true;
    this.cdr.detectChanges();

    // Enviamos el contenido actual para que la IA lo edite/mejore
    const currentContent = this.docBody.nativeElement.innerHTML;

    const payload = {
        prompt: this.iaPrompt,
        contexto: {
            ...this.contextoJson,
            texto_actual: currentContent 
        }
    };

    this.http.post('http://localhost:8080/api/ia/redactar-base', payload, { responseType: 'text' })
        .subscribe({
            next: (fullNewHtml) => {
                // SOBREESCRIBIMOS con la respuesta total de la IA (que ya trae lo anterior editado)
                this.content = fullNewHtml;
                if (this.docBody) this.docBody.nativeElement.innerHTML = fullNewHtml;
                
                this.isDraftingIA = false;
                this.iaPrompt = '';
                this.cdr.detectChanges();
                this.collabService.sendDocumentContent(this.instanciaId, fullNewHtml, this.me?.email);
            },
            error: () => {
                this.isDraftingIA = false;
                alert("Error al generar borrador con IA");
                this.cdr.detectChanges();
            }
        });
  }

  autoRellenar() {
    console.log(">> [EDITOR] Auto-rellenando campos del formulario...");
    let html = this.docBody.nativeElement.innerHTML;
    const data = this.contextoJson || {};

    // Rellenado por SISTEMA (Sin IA): Busca [campo] insensible a mayúsculas/minúsculas
    Object.keys(data).forEach(key => {
        // Regex /\[key\]/gi -> g: global, i: case-insensitive
        const regex = new RegExp(`\\[${key}\\]`, 'gi');
        const valor = data[key];
        
        if (valor !== undefined && valor !== null) {
            html = html.replace(regex, `<span class="magic-var-injected">${valor}</span>`);
        }
    });

    // Caso especial para fecha
    html = html.replace(/\[FECHA_ACTUAL\]/gi, new Date().toLocaleDateString());

    this.content = html;
    this.docBody.nativeElement.innerHTML = html;
    this.collabService.sendDocumentContent(this.instanciaId, html, this.me?.email);
    this.cdr.detectChanges();
  }

  toggleVersions() {
    this.showVersionsSidebar = !this.showVersionsSidebar;
    if (this.showVersionsSidebar && this.selectedDocument && !this.selectedDocument.id.startsWith('new-')) {
      this.loadVersions();
    }
  }

  private loadVersions() {
    this.http.get<any[]>(`http://localhost:8080/api/documentos/${this.selectedDocument.id}/versiones`)
      .subscribe(res => {
        this.versiones = res;
        this.cdr.detectChanges();
      });
  }

  viewVersion(v: any) {
    this.viewingVersion = v;
    this.content = v.contenidoHtml || '';
    if (this.docBody) this.docBody.nativeElement.innerHTML = this.content;
    this.isCapsuleMode = !v.esActual;
    this.cdr.detectChanges();
  }

  restoreVersion() {
    if (!this.viewingVersion) return;
    if (!confirm('¿Desea restaurar esta versión? Se creará una nueva versión actual basada en esta.')) return;

    this.http.post(`http://localhost:8080/api/documentos/${this.viewingVersion.id}/restaurar`, null, {
      params: { 
        userEmail: this.me?.email || '', 
        funcionarioNombre: `${this.me?.nombre} ${this.me?.apellido}` 
      }
    }).subscribe(() => {
      alert('¡Versión restaurada con éxito!');
      this.completed.emit();
    });
  }

  generarDocumento() {
    if (!confirm('¿Está seguro de guardar este documento de gestión?')) return;
    
    this.isGenerating = true;
    const finalHtml = this.docBody.nativeElement.innerHTML;

    const payload = {
        instanciaId: this.instanciaId,
        nombreArchivo: this.selectedDocument?.nombreArchivo || ('Documento_Gestion_' + new Date().getTime() + '.html'),
        contenidoHtml: finalHtml,
        userEmail: this.me?.email,
        funcionarioNombre: `${this.me?.nombre} ${this.me?.apellido}`,
        departamentoNombre: 'Área de Gestión',
        clienteCi: this.instancia?.clienteCi || 'CI-DESCONOCIDO'
    };

    this.http.post('http://localhost:8080/api/documentos/colaborativo/guardar', payload).subscribe({
      next: (res: any) => {
        this.isGenerating = false;
        // En lugar de emitir completed (que cierra el editor), actualizamos el documento actual
        this.selectedDocument = res;
        alert('Documento guardado con éxito. Puede seguir editando.');
        this.loadVersions(); // Recargar historial si estaba abierto
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error guardando doc:", err);
        this.isGenerating = false;
        alert('Error al guardar el documento. Verifique su conexión.');
      }
    });
  }

  ngOnDestroy() {
    if (this.cursorSyncInterval) clearInterval(this.cursorSyncInterval);
  }

  initDefaultContent() {
    this.content = '';
  }

  setupCollaboration() {
    this.collabService.joinDocumentSync(this.instanciaId, (data: any) => {
      if (data.sender !== this.me?.email) {
        if (this.docBody && this.docBody.nativeElement.innerHTML !== data.content) {
          this.docBody.nativeElement.innerHTML = data.content;
          this.content = data.content;
        }
      }
    });

    this.collabService.joinDocumentCursors(this.instanciaId, (data: any) => {
      if (data.sender !== this.me?.email) {
        this.remoteCursors[data.sender] = data;
        const existing = this.collaborators.find(c => c.email === data.sender);
        if (existing) {
          existing.avatar = data.avatar;
          existing.name = data.name;
        } else {
          this.collaborators.push({ email: data.sender, name: data.name, avatar: data.avatar });
        }
        this.cdr.detectChanges();
      }
    });
  }

  onContentInput(event: any) {
    const newContent = event.target.innerHTML;
    this.collabService.sendDocumentContent(this.instanciaId, newContent, this.me?.email);
  }

  onMouseMove(event: MouseEvent) {
    if (!this.docBody) return;
    const rect = this.docBody.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.collabService.sendDocumentCursor(this.instanciaId, { 
        x, y, 
        name: this.me?.nombre, 
        sender: this.me?.email,
        avatar: this.me?.avatar 
    });
  }

  execCommand(cmd: string) {
    document.execCommand(cmd, false, '');
  }
}
