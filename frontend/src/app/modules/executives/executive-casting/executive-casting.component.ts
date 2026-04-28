import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BpmsService, Departamento, UsuarioEjecutivo } from '../../../services/bpms.service';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { FilterByIdPipe } from '../../../pipes/filter-by-id.pipe';

@Component({
  selector: 'app-executive-casting',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatIconModule, 
    MatButtonModule, MatSelectModule, MatSnackBarModule, MatFormFieldModule, MatDialogModule,
    FilterByIdPipe
  ],
  templateUrl: './executive-casting.component.html',
  styleUrls: ['./executive-casting.component.css']
})
export class ExecutiveCastingComponent implements OnInit {
  ejecutivos: UsuarioEjecutivo[] = [];
  departamentos: Departamento[] = [];

  constructor(
    private bpmsService: BpmsService, 
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.bpmsService.listarDepartamentos().subscribe(data => {
       this.departamentos = data;
       this.cdr.detectChanges();
    });
    this.bpmsService.listarEjecutivos().subscribe(data => {
       this.ejecutivos = data;
       this.cdr.detectChanges();
    });
  }

  asignar(exec: UsuarioEjecutivo) {
    if(!exec.id) return;
    
    // El array de IDs ya viene en exec.departamentoIds gracias al [(ngModel)] múltiple
    const ids = exec.departamentoIds || [];

    this.bpmsService.asignarDepartamentos(exec.id, ids).subscribe({
      next: () => {
        this.snackBar.open(`✅ Asignación actualizada para ${exec.nombre}`, 'OK', {
          duration: 3000,
          panelClass: ['snack-success-premium'],
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      },
      error: () => {
        this.snackBar.open('❌ Error al actualizar departamentos', 'Cerrar', {
           duration: 5000,
           panelClass: ['snack-error-premium']
        });
      }
    });
  }

  getNombresDeptos(ids: string[] | undefined): string {
    if (!ids || ids.length === 0) return 'Ningún departamento asignado';
    return this.departamentos
      .filter(d => ids.includes(d.id!))
      .map(d => d.nombreNormalizado)
      .join(', ');
  }
}
