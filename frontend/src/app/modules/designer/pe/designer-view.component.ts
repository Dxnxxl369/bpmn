import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { BpmsService, PoliticaNegocio } from '../../../services/bpms.service';
import { BpmnEditorComponent } from '../../../components/bpmn-editor/bpmn-editor.component';
import { AnaliticasDashboardComponent } from '../../../components/analiticas-dashboard/analiticas-dashboard.component';
import { PublishResultDialogComponent } from '../../../components/publish-result-dialog/publish-result-dialog.component';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { FormularioDinamicoComponent } from '../../../components/formulario-dinamico/formulario-dinamico.component';

import { AiAssistantService } from '../../../services/ai-assistant.service';
import { CollaborationService } from '../../../services/collaboration.service';
import { AuthService } from '../../../services/auth.service';
import { Subscription, filter } from 'rxjs';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';

interface Field { id: string; label: string; type: string; required: boolean; options?: string[]; pattern?: string; errorMessage?: string; }

@Component({
  selector: 'app-designer-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatTabsModule, MatProgressBarModule, MatTooltipModule, MatSnackBarModule, MatDialogModule, MatSelectModule, MatDividerModule, BpmnEditorComponent, AnaliticasDashboardComponent, FormularioDinamicoComponent, DragDropModule, ConfirmDialogComponent],
  templateUrl: './designer-view.component.html',
  styleUrls: ['./designer-view.component.css']
})
export class DesignerViewComponent implements OnInit {
  @ViewChild('bpmnEditor') bpmnEditor!: BpmnEditorComponent;

  textoManual: string = ''; miNombre: string = ''; miAvatar: string = ''; miEmail: string = '';
  procesando: boolean = false; generandoTodo: boolean = false; porcentajeCarga: number = 0; mensajeEstado: string = '';
  borradores: PoliticaNegocio[] = []; publicadas: PoliticaNegocio[] = []; previewPoliticas: PoliticaNegocio[] = [];
  politicaSeleccionada?: PoliticaNegocio;
  tareasLab: any[] = []; tareaSeleccionada: any = null; campoResaltadoId: string | null = null;
  camposActuales: Field[] = []; jsonSchemaString: string = '[]'; listoParaPublicar: boolean = false;
  colaboradores: any[] = []; cursoresRemotos: any[] = [];
  activeTabIndex: number = 0; repoTabIndex: number = 0;

  tareaPrevisualizada: any = null;
  schemaPrevia: string = '[]';

  constructor(private bpmsService: BpmsService, private snackBar: MatSnackBar, private dialog: MatDialog, private cdr: ChangeDetectorRef, private aiService: AiAssistantService, private collabService: CollaborationService, private authService: AuthService) {}

  ngOnInit() { 
    this.authService.user$.subscribe(user => { 
      if (user) { 
        this.miNombre = `${user.nombre} ${user.apellido}`; 
        this.miAvatar = user.avatar; 
        this.miEmail = user.email;
        this.cdr.detectChanges(); 
      } 
    });

    this.cargarPoliticas(); 
    this.aiService.resetContext();

    this.collabService.globalPresence$.subscribe(users => { 
      if (this.miEmail && this.politicaSeleccionada?.id) {
        this.colaboradores = users.filter(u => 
          u.userId !== this.miEmail && 
          u.politicaId === this.politicaSeleccionada?.id
        );
        this.cdr.detectChanges();
      }
    });
    this.collabService.cursors$.subscribe(cursors => { this.cursoresRemotos = cursors; this.cdr.detectChanges(); });
    this.collabService.schemaSync$.subscribe(newSchema => { 
      if (newSchema && this.tareaSeleccionada) { 
        this.camposActuales = JSON.parse(newSchema); 
        this.jsonSchemaString = newSchema; 
        this.cdr.detectChanges(); 
      } 
    });

    this.aiService.formUpdate$.subscribe(newSchema => {
      if (newSchema && this.tareaSeleccionada) {
        this.camposActuales = JSON.parse(newSchema);
        this.sincronizarJSON();
      }
    });
  }

  onTabChange(event: any) { this.activeTabIndex = event.index; if (event.index === 1 && this.politicaSeleccionada) this.cargarTareasLab(); this.cdr.detectChanges(); }

  marcarComoCliente(t: any) {
    if (this.politicaSeleccionada?.estado === 'ACTIVA') return;
    
    const esClienteActual = t.nombre.toUpperCase().includes('VERIFICAR SOLICITUD');
    
    const dialogData = esClienteActual ? {
      title: 'Quitar Modo Cliente',
      message: `¿Deseas retirar el acceso digital de "${t.nombre}"? El ciudadano ya no verá este formulario.`,
      icon: 'inventory_2', // Icono de aviso rojo
      confirmText: 'SÍ, QUITAR ROL'
    } : {
      title: 'Asignar como Cliente',
      message: `¿Quieres marcar "${t.nombre}" como la puerta de entrada oficial para el ciudadano en el portal?`,
      icon: 'rocket_launch', // Icono de cohete/lanzamiento
      confirmText: 'SÍ, ASIGNAR'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, { width: '450px', data: dialogData });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (esClienteActual) {
          t.nombre = t.nombre.replace(' - VERIFICAR SOLICITUD', '').replace('VERIFICAR SOLICITUD', '').trim() || 'Actividad';
          this.snackBar.open(`ℹ️ Modo Ciudadano retirado.`, 'OK', { 
            duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom'
          });
        } else {
          // Limpiamos otros
          this.tareasLab.forEach(tarea => {
            if (tarea.nombre.toUpperCase().includes('VERIFICAR SOLICITUD')) {
              tarea.nombre = tarea.nombre.replace(' - VERIFICAR SOLICITUD', '').replace('VERIFICAR SOLICITUD', '').trim() || 'Actividad';
            }
          });
          // Asignamos al nuevo
          t.nombre = t.nombre + ' - VERIFICAR SOLICITUD';
          this.snackBar.open(`✅ "${t.nombre}" asignado correctamente.`, 'OK', { 
            duration: 3000, panelClass: ['snack-success-premium'],
            horizontalPosition: 'center', verticalPosition: 'bottom'
          });
        }
        this.cdr.detectChanges();
      }
    });
  }

  seleccionarPolitica(p: PoliticaNegocio) { 
    this.politicaSeleccionada = p; this.actualizarStatusLab();
    this.aiService.setContext({ id: p.id, name: p.nombre, manual: p.descripcion, mode: 'diseno' });
    if (p.id) this.collabService.conectar(p.id);
  }

  cerrarEditor() { if (this.politicaSeleccionada?.id) this.collabService.desconectar(this.politicaSeleccionada.id); this.politicaSeleccionada = undefined; this.cargarPoliticas(); this.tareaSeleccionada = null; this.tareaPrevisualizada = null; this.aiService.resetContext(); }

  cargarPoliticas() { 
    this.bpmsService.listarPoliticas().subscribe({ 
      next: data => { 
        this.borradores = data.filter(p => p.estado === 'BORRADOR'); 
        this.publicadas = data.filter(p => p.estado === 'ACTIVA');
        this.cdr.detectChanges(); 
      }, 
      error: err => { 
        console.error('Error al cargar politicas:', err); 
        this.snackBar.open('Error al conectar con el servidor', 'Cerrar', { duration: 5000 }); 
      } 
    }); 
  }

  mandarABorrador(p: PoliticaNegocio) {
    if (!p.id) return;
    
    // Usamos el servicio para cambiar el estado de la política a BORRADOR
    // Si no hay un endpoint específico, actualizamos el objeto completo
    const politicaActualizada = { ...p, estado: 'BORRADOR' };
    
    this.bpmsService.actualizarPolitica(p.id, politicaActualizada).subscribe({
      next: () => {
        this.snackBar.open(`✅ '${p.nombre}' ha vuelto a borradores.`, 'OK', { 
          duration: 3000, 
          panelClass: ['snack-success-premium'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.cargarPoliticas(); // Recarga las listas para mover el item de pestaña
      },
      error: () => {
        // Si el update falla, intentamos con archivar (algunos backends lo manejan así)
        this.bpmsService.archivarPolitica(p.id!).subscribe({
          next: () => {
            this.cargarPoliticas();
            this.snackBar.open(`✅ '${p.nombre}' archivado y disponible para edición.`, 'OK', { duration: 3000 });
          },
          error: () => this.snackBar.open('❌ No se pudo cambiar el estado de la política', 'Cerrar')
        });
      }
    });
  }

  onFileSelected(event: any) { const file = event.target.files[0]; if (file) { this.procesando = true; this.porcentajeCarga = 0; this.mensajeEstado = 'Analizando PDF...'; const int = setInterval(() => { if(this.porcentajeCarga < 90) this.porcentajeCarga += 5; this.cdr.detectChanges(); }, 500); this.bpmsService.procesarDocumento(file).subscribe({ next: (res) => { clearInterval(int); this.porcentajeCarga = 100; setTimeout(() => { this.previewPoliticas = res; this.procesando = false; this.cdr.detectChanges(); }, 500); }, error: () => { clearInterval(int); this.procesando = false; this.cdr.detectChanges(); } }); } }
  procesarTexto() { if (!this.textoManual) return; this.procesando = true; this.porcentajeCarga = 0; this.mensajeEstado = 'Analizando manual...'; this.bpmsService.procesarTextoManual(this.textoManual).subscribe({ next: (res) => { this.previewPoliticas = res; this.procesando = false; this.textoManual = ''; this.cdr.detectChanges(); }, error: () => { this.procesando = false; this.cdr.detectChanges(); } }); }
  generarTodosFormularios() { if (!this.politicaSeleccionada?.id) return; this.generandoTodo = true; const promises = this.tareasLab.map(t => this.bpmsService.generarFormularioIA(this.politicaSeleccionada!.id!, t.id, t.nombre).toPromise()); Promise.all(promises).then(() => { this.generandoTodo = false; this.cargarTareasLab(); this.actualizarStatusLab(); this.cdr.detectChanges(); }).catch(() => { this.generandoTodo = false; this.cdr.detectChanges(); }); }
  actualizarStatusLab() { if (!this.politicaSeleccionada?.id) return; this.bpmsService.getFormularioStatus(this.politicaSeleccionada.id).subscribe(status => { this.listoParaPublicar = status.listoParaPublicar; this.cdr.detectChanges(); }); }
  cargarTareasLab() { if (!this.politicaSeleccionada?.id) return; this.bpmsService.listarTareasPolitica(this.politicaSeleccionada.id).subscribe(tareas => { this.tareasLab = tareas; this.cdr.detectChanges(); }); }
  
  previsualizarTarea(t: any) {
    this.tareaPrevisualizada = t;
    if (t.tieneFormulario || t.estadoFormulario !== 'VACIO') {
      this.bpmsService.generarFormulario(this.politicaSeleccionada!.id!, t.id).subscribe(schema => {
        this.schemaPrevia = schema;
        this.cdr.detectChanges();
      });
    } else {
      this.schemaPrevia = '[]';
      this.cdr.detectChanges();
    }
  }

  seleccionarTareaLab(t: any) { 
    this.tareaSeleccionada = t; 
    this.aiService.setContext({ 
      id: this.politicaSeleccionada?.id, 
      name: `${this.politicaSeleccionada?.nombre} > ${t.nombre}`, 
      manual: this.politicaSeleccionada?.descripcion, 
      mode: 'diseno' 
    });

    if (t.tieneFormulario || t.estadoFormulario !== 'VACIO') { 
      this.bpmsService.generarFormulario(this.politicaSeleccionada!.id!, t.id).subscribe(schema => { 
        this.camposActuales = JSON.parse(schema); 
        this.jsonSchemaString = schema; 
        this.cdr.detectChanges(); 
      }); 
    } else { 
      this.camposActuales = []; 
      this.jsonSchemaString = '[]'; 
      this.cdr.detectChanges(); 
    } 
  }

  agregarOpcion(field: Field) {
    if (!field.options) field.options = [];
    field.options.push(`Nueva Opcion ${field.options.length + 1}`);
    this.sincronizarJSON();
  }

  eliminarOpcion(field: Field, idx: number) {
    if (field.options) {
      field.options.splice(idx, 1);
      this.sincronizarJSON();
    }
  }

  onDrop(event: CdkDragDrop<Field[]>) {
    moveItemInArray(this.camposActuales, event.previousIndex, event.currentIndex);
    this.sincronizarJSON();
  }

  onMouseMove(event: MouseEvent) { if (this.politicaSeleccionada?.id && this.tareaSeleccionada) this.collabService.enviarMovimiento(this.politicaSeleccionada.id, event.clientX, event.clientY); }
  agregarCampo(type: string) { const newField: Field = { id: `campo_${Date.now()}`, label: type === 'button' ? 'NUEVO BOTON' : 'Campo ' + (this.camposActuales.length + 1), type: type, required: type !== 'button' }; if (type === 'select') newField.options = ['Opcion 1', 'Opcion 2']; this.camposActuales.push(newField); this.sincronizarJSON(); }
  eliminarCampo(idx: number) { this.camposActuales.splice(idx, 1); this.sincronizarJSON(); }
  sincronizarJSON() { this.jsonSchemaString = JSON.stringify(this.camposActuales); this.cdr.detectChanges(); if (this.politicaSeleccionada?.id) this.collabService.enviarEsquema(this.politicaSeleccionada.id, this.jsonSchemaString); }
  
  guardarProgreso(estado: string) { 
    if (!this.tareaSeleccionada) return; 
    this.bpmsService.guardarFormularioManual(this.politicaSeleccionada!.id!, this.tareaSeleccionada.id, this.jsonSchemaString, estado).subscribe({ 
      next: () => { 
        this.tareaSeleccionada.estadoFormulario = estado;
        const index = this.tareasLab.findIndex(t => t.id === this.tareaSeleccionada.id);
        if (index !== -1) this.tareasLab[index].estadoFormulario = estado;

        this.actualizarStatusLab(); 
        this.cargarTareasLab(); 
        
        const msg = estado === 'LISTO' ? '✅ Formulario validado con éxito' : '📝 Guardado como borrador';
        this.snackBar.open(msg, 'ENTENDIDO', { 
          duration: 3000, 
          panelClass: estado === 'LISTO' ? ['snack-success-premium'] : ['snack-info-premium'],
          horizontalPosition: 'center', verticalPosition: 'top'
        }); 

        if (estado === 'LISTO') this.tareaSeleccionada = null; 
      } 
    }); 
  }

  generarFormularioIndividual(t: any) { const promptManual = prompt(`IA: ¿Que deseas cambiar o agregar en '${t.nombre}'?`, ""); if (promptManual !== null) { this.bpmsService.generarFormularioIA(this.politicaSeleccionada!.id!, t.id, `${t.nombre}. INSTRUCCION ADICIONAL: ${promptManual}. ESQUEMA ACTUAL: ${this.jsonSchemaString}`).subscribe({ next: (res) => { this.camposActuales = JSON.parse(res.schemaJson); this.jsonSchemaString = res.schemaJson; this.cdr.detectChanges(); if (this.politicaSeleccionada?.id) this.collabService.enviarEsquema(this.politicaSeleccionada.id, this.jsonSchemaString); } }); } }
  
  intentarPublicar() {
    if (!this.listoParaPublicar) {
      this.snackBar.open('BLOQUEADO: No puedes publicar mientras no estén listos todos los formularios', 'REVISAR', { 
        duration: 5000, panelClass: ['snack-error-premium'], horizontalPosition: 'center', verticalPosition: 'top'
      });
      return;
    }
    this.publicarProceso();
  }

  publicarProceso() { 
    this.bpmsService.activarPolitica(this.politicaSeleccionada!.id!).subscribe({ 
      next: (res) => { 
        this.dialog.open(PublishResultDialogComponent, { width: '500px', data: { report: res.report } }); 
        this.cerrarEditor(); 
      } 
    }); 
  }

  async guardarBPMN() { try { const { xml } = await this.bpmnEditor['modeler'].saveXML({ format: true }); this.bpmsService.guardarDiagrama(this.politicaSeleccionada!.id!, xml).subscribe(() => { this.snackBar.open('Diagrama guardado exitosamente', 'OK', { duration: 2000 }); }); } catch (e) { console.error(e); } }
  trackByIndex(index: number): number { return index; }
}
