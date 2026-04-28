import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BpmsService, Departamento } from '../../../services/bpms.service';

@Component({
  selector: 'app-department-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatIconModule, MatButtonModule, MatInputModule, MatSnackBarModule, MatProgressBarModule],
  templateUrl: './department-manager.component.html',
  styleUrls: ['./department-manager.component.css']
})
export class DepartmentManagerComponent implements OnInit {
  departamentos: Departamento[] = [];
  sincronizando: boolean = false;

  constructor(private bpmsService: BpmsService, private snackBar: MatSnackBar, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarDepartamentos();
  }

  cargarDepartamentos() {
    console.log('Intentando cargar departamentos desde el servidor...');
    this.bpmsService.listarDepartamentos().subscribe({
      next: data => {
        console.log('Departamentos recibidos:', data);
        this.departamentos = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al listar departamentos:', err);
        this.snackBar.open('❌ Error de conexión con la base de datos', 'Cerrar', { 
          verticalPosition: 'bottom', horizontalPosition: 'center' 
        });
      }
    });
  }

  resincronizarTodo() {
    this.sincronizando = true;
    this.snackBar.open('🔄 Refrescando diccionario de departamentos...', 'Cerrar', { 
      duration: 2000, horizontalPosition: 'center', verticalPosition: 'bottom'
    });
    
    // Llamamos a la sincronización del backend
    this.bpmsService.resincronizarDepartamentos().subscribe({
      next: () => {
        this.sincronizando = false;
        this.cargarDepartamentos();
        this.snackBar.open('✅ Diccionario actualizado', 'OK', { 
          duration: 3000, panelClass: ['snack-success-premium'],
          horizontalPosition: 'center', verticalPosition: 'bottom'
        });
      },
      error: (err) => {
        this.sincronizando = false;
        console.warn('El backend falló al resincronizar, pero intentamos cargar existentes...');
        // Si el "resync" falla (carriles no procesados), igual cargamos lo que ya hay en la BD
        this.cargarDepartamentos();
      }
    });
  }

  guardar(dept: Departamento) {
    if (!dept.nombreNormalizado) {
      this.snackBar.open('⚠️ Por favor escribe un nombre oficial', 'OK', { duration: 2000 });
      return;
    }
    this.bpmsService.guardarDepartamento(dept).subscribe({
      next: () => {
        this.snackBar.open('✅ Guardado correctamente', 'OK', { 
          duration: 3000, panelClass: ['snack-success-premium'],
          horizontalPosition: 'center', verticalPosition: 'bottom'
        });
        this.cargarDepartamentos(); // Recargamos para confirmar
      },
      error: () => this.snackBar.open('❌ Error al guardar cambios', 'Cerrar', { duration: 3000 })
    });
  }
}
