import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-reportes-dinamicos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTableModule, MatSelectModule, MatCheckboxModule, MatTooltipModule],
  templateUrl: './reportes-dinamicos.component.html',
  styleUrls: ['./reportes-dinamicos.component.css']
})
export class ReportesDinamicosComponent implements OnInit {
  prompt: string = '';
  isProcessing: boolean = false;
  results: any[] = [];
  debugIA: string = '';
  showDebug: boolean = false;
  
  // UI TOGGLES (COMPACT MODE)
  showManualFilters: boolean = false;
  showVisibilityMenu: boolean = false;

  // BI STATS
  summaryIA: string = '';
  totalFound: number = 0;
  targetType: string = '';

  allColumns = [
    { id: 'fecha', label: 'Fecha', width: 120 },
    { id: 'hora', label: 'Hora', width: 100 },
    { id: 'usuarioNombre', label: 'Funcionario / Item', width: 220 },
    { id: 'rol', label: 'Rol', width: 120 },
    { id: 'departamento', label: 'Departamento / Área', width: 200 },
    { id: 'cantidad', label: 'Cantidad', width: 100 },
    { id: 'email', label: 'Email', width: 220 }
  ];
  
  displayedColumns: string[] = ['fecha', 'hora', 'usuarioNombre', 'rol', 'departamento'];

  manualFilters = { departamento: '', fechaInicio: '', fechaFin: '', horaInicio: '00:00', horaFin: '23:59', rol: '', usuarioId: '' };

  departamentos: any[] = [];
  usuarios: any[] = [];
  roles: string[] = ['ADMINISTRADOR', 'FUNCIONARIO', 'CIUDADANO'];

  // RECONOCIMIENTO DE VOZ
  isListening: boolean = false;
  private recognition: any;

  // LÓGICA DE RESIZING
  pressed = false;
  currentCol: any;
  startX: number = 0;
  startWidth: number = 0;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.initVoiceRecognition();
    this.cargarCatalogos();
    this.aplicarFiltrosManuales();
  }

  initVoiceRecognition() {
    const Window: any = window as any;
    const SpeechRecognition = Window.SpeechRecognition || Window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        this.prompt = text;
        this.isListening = false;
        this.generarReporteIA();
        this.cdr.detectChanges();
      };
      this.recognition.onend = () => { this.isListening = false; this.cdr.detectChanges(); };
      this.recognition.onerror = () => { this.isListening = false; this.cdr.detectChanges(); };
    }
  }

  toggleListening() {
    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.isListening = true;
      this.recognition.start();
    }
  }

  onResizeColumn(event: any, columnId: string) {
    this.pressed = true;
    this.currentCol = this.allColumns.find(c => c.id === columnId);
    this.startX = event.pageX;
    this.startWidth = this.currentCol.width;
    event.preventDefault();
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.pressed || !this.currentCol) return;
    const deltaX = event.pageX - this.startX;
    this.currentCol.width = Math.max(60, this.startWidth + deltaX);
    this.cdr.detectChanges();
  }

  @HostListener('window:mouseup')
  onMouseUp() { this.pressed = false; this.currentCol = null; }

  getColumnWidth(colId: string): string {
    const col = this.allColumns.find(c => c.id === colId);
    return col ? `${col.width}px` : 'auto';
  }

  cargarCatalogos() {
    this.http.get<any[]>('http://localhost:8080/api/departamentos').subscribe(res => { this.departamentos = res; this.cdr.detectChanges(); });
    this.http.get<any[]>('http://localhost:8080/api/usuarios/ejecutivos').subscribe(res => { this.usuarios = res; this.cdr.detectChanges(); });
  }

  toggleColumn(columnId: string) {
    const index = this.displayedColumns.indexOf(columnId);
    if (index > -1) this.displayedColumns.splice(index, 1);
    else {
      this.displayedColumns.push(columnId);
      this.displayedColumns.sort((a, b) => this.allColumns.findIndex(c => c.id === a) - this.allColumns.findIndex(c => c.id === b));
    }
    this.cdr.detectChanges();
  }

  generarReporteIA() {
    if (!this.prompt.trim()) return;
    this.isProcessing = true;
    this.http.post<any>('http://localhost:8080/api/reportes/ia-filtro', { prompt: this.prompt })
      .subscribe({
        next: (res) => {
          this.debugIA = res.debug_ia || 'Sin info';
          this.summaryIA = res.resumen || '';
          this.totalFound = res.total || 0;
          this.targetType = res.target || '';
          if (res.data) { this.results = this.transformData(res.data); }
          if (res.visibilidad) {
            this.displayedColumns = this.allColumns
                .filter(c => res.visibilidad[c.id] === true)
                .map(c => c.id);
          }
          this.isProcessing = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isProcessing = false; this.cdr.detectChanges(); }
      });
  }

  aplicarFiltrosManuales() {
    this.isProcessing = true;
    const fInicio = this.manualFilters.fechaInicio ? `${this.manualFilters.fechaInicio}T${this.manualFilters.horaInicio}:00` : null;
    const fFin = this.manualFilters.fechaFin ? `${this.manualFilters.fechaFin}T${this.manualFilters.horaFin}:59` : null;
    const payload = { departamentoNombre: this.manualFilters.departamento, fechaInicio: fInicio, fechaFin: fFin, rol: this.manualFilters.rol, usuarioId: this.manualFilters.usuarioId };

    this.http.post<any>('http://localhost:8080/api/reportes/manual', payload)
      .subscribe({
        next: (res) => { 
          if (res && res.data) { this.results = this.transformData(res.data); }
          this.summaryIA = 'Búsqueda Manual Ejecutada';
          this.totalFound = this.results.length;
          this.targetType = 'ACTIVIDAD';
          this.isProcessing = false; 
          this.showManualFilters = false;
          this.cdr.detectChanges(); 
        },
        error: () => { this.isProcessing = false; this.cdr.detectChanges(); }
      });
  }

  private transformData(data: any[]): any[] {
    if (!data || typeof data.map !== 'function') return [];
    return data.map((item: any) => {
        try {
            const res: any = { ...item };
            if (item.timestamp) {
                const dt = new Date(item.timestamp);
                res.fecha = dt.toLocaleDateString();
                res.hora = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else { res.fecha = '-'; res.hora = '-'; }
            return res;
        } catch (e) { return { ...item, fecha: '-', hora: '-' }; }
    });
  }

  exportar(formato: 'pdf' | 'xlsx') {
    if (this.results.length === 0) return;
    if (formato === 'xlsx') this.exportToExcel(); else this.exportToPDF();
  }

  private exportToExcel() {
    const headers = this.displayedColumns.map(colId => this.allColumns.find(c => c.id === colId)?.label).join(',');
    const rows = this.results.map(row => this.displayedColumns.map(colId => `"${(row[colId] || '').toString().replace(/"/g, '""')}"`).join(','));
    const csvContent = "\uFEFF" + headers + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `Reporte_BI_${new Date().getTime()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  private exportToPDF() {
    const printContent = document.querySelector('.table-wrapper')?.innerHTML;
    const windowPrint = window.open('', '', 'width=900,height=900');
    if (windowPrint) {
      windowPrint.document.write(`<html><head><title>Reporte Suite BPMS</title><style>body{font-family:sans-serif;padding:40px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:10px;text-align:left;font-size:11px;}th{background:#f4f4f4;}.header{text-align:center;margin-bottom:20px;}</style></head><body><div class="header"><h1>Reporte Inteligente</h1><p>${this.summaryIA}</p></div><table>${printContent}</table></body></html>`);
      windowPrint.document.close(); windowPrint.focus(); windowPrint.print(); windowPrint.close();
    }
  }
}
