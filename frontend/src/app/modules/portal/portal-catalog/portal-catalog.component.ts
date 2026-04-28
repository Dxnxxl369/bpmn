import { Component, OnInit, ViewChild, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BpmsService, PoliticaNegocio } from '../../../services/bpms.service';
import { FormularioDinamicoComponent } from '../../../components/formulario-dinamico/formulario-dinamico.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-portal-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatDialogModule, MatProgressBarModule, MatSnackBarModule, FormularioDinamicoComponent],
  templateUrl: './portal-catalog.component.html',
  styleUrls: ['./portal-catalog.component.css']
})
export class PortalCatalogComponent implements OnInit {
  @ViewChild('dialogInicio') dialogInicio!: TemplateRef<any>;

  servicios: PoliticaNegocio[] = [];
  serviciosFiltrados: PoliticaNegocio[] = [];
  busqueda: string = '';
  tokenBusqueda: string = '';
  isDarkMode: boolean = false;

  servicioSeleccionado: PoliticaNegocio | null = null;
  schemaCliente: string = '';
  errorCarga: boolean = false;

  constructor(
    private bpmsService: BpmsService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.cargarServicios();
    this.isDarkMode = document.body.classList.contains('dark-mode');
  }

  cargarServicios() {
    // Usamos el endpoint público que devuelve solo políticas ACTIVAS
    this.bpmsService.listarPoliticas().subscribe({
      next: (data) => {
        this.servicios = data.filter(p => p.estado === 'ACTIVA');
        this.serviciosFiltrados = [...this.servicios];
        this.cdr.detectChanges();
      }
    });
  }

  filtrar() {
    const term = this.busqueda.toLowerCase();
    this.serviciosFiltrados = this.servicios.filter(s => 
      s.nombre.toLowerCase().includes(term) || 
      s.descripcion.toLowerCase().includes(term)
    );
  }

  abrirDialogoInicio(s: PoliticaNegocio) {
    this.servicioSeleccionado = s;
    this.schemaCliente = '';
    this.errorCarga = false;

    this.dialog.open(this.dialogInicio, {
      width: '650px',
      panelClass: 'custom-dialog-container',
      disableClose: true
    });

    this.bpmsService.listarTareasPolitica(s.id!).subscribe({
      next: (tareas) => {
        // En el nuevo flujo "limpio", tomamos la primera tarea que tenga un formulario diseñado.
        // O simplemente la primera tarea si no hay marcas especiales.
        const firstTask = tareas.find(t => t.tieneFormulario === true) || tareas[0];

        if (firstTask) {
          this.bpmsService.generarFormulario(s.id!, firstTask.taskDefinitionId || firstTask.id).subscribe(schema => {
            if (schema && schema !== '[]') {
              this.schemaCliente = schema;
              this.errorCarga = false;
            } else {
              this.errorCarga = true;
            }
            this.cdr.detectChanges();
          });
        } else {
          this.errorCarga = true;
          this.cdr.detectChanges();
        }
      },
      error: () => { this.errorCarga = true; this.cdr.detectChanges(); }
    });
  }

  confirmarInicio(respuestas: any) {
    if (!this.servicioSeleccionado?.id) return;

    this.bpmsService.iniciarTramitePresencial(this.servicioSeleccionado.id, JSON.stringify(respuestas)).subscribe({
      next: (res) => {
        this.dialog.closeAll();
        this.router.navigate(['/portal/seguimiento', res.token]);
      },
      error: () => alert('Error al procesar la solicitud con el motor BPMN.')
    });
  }

  irASeguimiento() { this.router.navigate(['/portal/seguimiento', this.tokenBusqueda]); }
}
