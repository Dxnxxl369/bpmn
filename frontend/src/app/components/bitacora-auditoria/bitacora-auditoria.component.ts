import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

export interface AuditoriaLog {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  modulo: string;
  entidadId: string;
  detalles: string;
  timestamp: string;
}

@Component({
  selector: 'app-bitacora-auditoria',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule, MatTooltipModule, FormsModule],
  templateUrl: './bitacora-auditoria.component.html',
  styleUrls: ['./bitacora-auditoria.component.css']
})
export class BitacoraAuditoriaComponent implements OnInit {
  displayedColumns: string[] = ['timestamp', 'usuario', 'modulo', 'accion', 'detalles'];
  dataSource = new MatTableDataSource<any>([]);
  allLogs: AuditoriaLog[] = [];
  
  // OPCIÓN DE AGRUPAMIENTO
  modoAgrupado: boolean = true;

  // FILTROS
  filtroUsuario: string = '';
  filtroModulo: string = '';
  filtroFecha: string = '';
  filtroHoraInicio: string = '00:00';
  filtroHoraFin: string = '23:59';

  modulosDisponibles: string[] = ['DISEÑADOR IA', 'DEPARTAMENTOS', 'CASTING HUMANO', 'MONITOR GLOBAL', 'FORMULARIOS', 'USUARIOS'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.http.get<AuditoriaLog[]>('http://localhost:8080/api/auditoria').subscribe({
      next: (data) => {
        this.allLogs = data;
        this.procesarVista();
      },
      error: (err) => console.error('Error cargando auditoría', err)
    });
  }

  procesarVista() {
    let base = [...this.allLogs];

    // Aplicar filtros básicos primero
    if (this.filtroUsuario) {
      base = base.filter(l => 
        l.usuarioNombre.toLowerCase().includes(this.filtroUsuario.toLowerCase()) ||
        l.usuarioId.toLowerCase().includes(this.filtroUsuario.toLowerCase())
      );
    }

    if (this.filtroModulo) {
      base = base.filter(l => l.modulo === this.filtroModulo);
    }

    if (this.filtroFecha) {
      base = base.filter(l => {
        const logDate = new Date(l.timestamp).toISOString().split('T')[0];
        return logDate === this.filtroFecha;
      });
    }

    base = base.filter(l => {
      const logTime = new Date(l.timestamp).toTimeString().substring(0, 5);
      return logTime >= this.filtroHoraInicio && logTime <= this.filtroHoraFin;
    });

    if (this.modoAgrupado) {
        this.dataSource.data = this.aplicarJerarquia(base);
    } else {
        this.dataSource.data = base.map(l => ({ ...l, level: 0 }));
    }

    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private aplicarJerarquia(logs: AuditoriaLog[]): any[] {
    // Ordenar por tiempo ascendente para construir el árbol, luego invertiremos para ver lo último primero
    const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const tree: any[] = [];
    
    sorted.forEach(log => {
        const level = this.determinarNivel(log.accion);
        tree.push({ ...log, level });
    });

    // Invertir para que lo más reciente esté arriba
    return tree.reverse();
  }

  private determinarNivel(accion: string): number {
    // NIVEL 1: ACCESOS PRINCIPALES
    if (accion.includes('ACCESO_MODULO')) return 1;

    // NIVEL 2: ACCIONES DIRECTAS DE MÓDULO (HIJOS DE L1)
    if (accion.includes('ABRIR_POLITICA') || 
        accion.includes('GENERAR_IA') || 
        accion.includes('CREAR_DEPARTAMENTO') || 
        accion.includes('RENOMBRAR_DEPARTAMENTO') ||
        accion.includes('ELIMINAR_DEPARTAMENTO') ||
        accion.includes('ASIGNAR_DEPARTAMENTO') ||
        accion.includes('QUITAR_DEPARTAMENTO') ||
        accion.includes('ACTUALIZAR_PERFIL')) return 2;

    // NIVEL 3: ACCIONES DENTRO DE ENTIDADES (HIJOS DE L2)
    if (accion.includes('VISTA_FORMULARIOS') || 
        accion.includes('PUBLICAR') || 
        accion.includes('REVERTIR') || 
        accion.includes('RESTAURAR')) return 3;

    // NIVEL 4: DETALLES GRANULARES (HIJOS DE L3)
    if (accion.includes('FORMULARIO')) return 4;

    return 1;
  }

  aplicarFiltros() {
    this.procesarVista();
  }

  toggleAgrupamiento() {
    this.modoAgrupado = !this.modoAgrupado;
    this.procesarVista();
  }

  getAccionClass(accion: string): string {
    if (accion.includes('PUBLICAR') || accion.includes('CREAR') || accion.includes('GENERAR') || accion.includes('GUARDAR')) return 'action-create'; // VERDE
    if (accion.includes('EDITAR') || accion.includes('RENOMBRAR') || accion.includes('ASIGNAR') || accion.includes('ACTUALIZAR')) return 'action-edit'; // AZUL
    if (accion.includes('ELIMINAR') || accion.includes('REVERTIR') || accion.includes('QUITAR')) return 'action-delete'; // ROJO
    if (accion.includes('ACCESO') || accion.includes('ABRIR') || accion.includes('VISTA')) return 'action-view'; // AMARILLO
    return 'action-default';
  }

  getAccionIcon(accion: string): string {
    if (accion.includes('PUBLICAR')) return 'rocket_launch';
    if (accion.includes('IA') || accion.includes('GENERAR')) return 'auto_awesome';
    if (accion.includes('REVERTIR')) return 'history';
    if (accion.includes('EDITAR') || accion.includes('RENOMBRAR')) return 'edit_note';
    if (accion.includes('ASIGNAR')) return 'person_add';
    if (accion.includes('ELIMINAR') || accion.includes('QUITAR')) return 'delete_sweep';
    if (accion.includes('ACCESO') || accion.includes('ABRIR')) return 'login';
    return 'info';
  }
}
