import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgApexchartsModule, ChartComponent, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexDataLabels, ApexStroke, ApexYAxis, ApexFill, ApexTooltip, ApexPlotOptions, ApexLegend, ApexTheme, ApexGrid } from 'ng-apexcharts';
import { HttpClient } from '@angular/common/http';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  yaxis: ApexYAxis;
  fill: ApexFill;
  tooltip: ApexTooltip;
  colors: string[];
  plotOptions: ApexPlotOptions;
  legend: ApexLegend;
  theme: ApexTheme;
  grid: ApexGrid;
};

@Component({
  selector: 'app-global-analytics',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTableModule, NgApexchartsModule, MatProgressSpinnerModule],
  templateUrl: './global-analytics.component.html',
  styleUrls: ['./global-analytics.component.css']
})
export class GlobalAnalyticsComponent implements OnInit {
  @ViewChild("chart") chart!: ChartComponent;
  
  public trafficChartOptions!: Partial<ChartOptions>;
  public deptoChartOptions!: Partial<ChartOptions>;

  stats = {
    totalTareas: 0,
    eficienciaGlobal: 0,
    cuelloCritico: 'Cargando...',
    mejorFuncionario: 'Cargando...'
  };

  rankingGlobal: any[] = [];
  isDataLoaded = false;
  expandedFuncId: string | null = null; // CONTROL DE EXPANSIÓN

  constructor(private http: HttpClient) {
    this.initCharts();
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  initCharts() {
    this.trafficChartOptions = {
      series: [],
      chart: { height: 320, type: "area", toolbar: { show: false } },
      colors: ['#d35400'],
      xaxis: { categories: [], labels: { style: { colors: '#94a3b8' } } }
    };

    this.deptoChartOptions = {
      series: [],
      chart: { type: "bar", height: 350, stacked: true, toolbar: { show: false } },
      colors: ['#d35400', '#27ae60'],
      xaxis: { categories: [], labels: { style: { colors: '#94a3b8' } } }
    };
  }

  toggleExpand(nombre: string) {
    this.expandedFuncId = (this.expandedFuncId === nombre) ? null : nombre;
  }

  cargarDatos() {
    this.http.get<any>('http://13.217.197.171:8080/api/analiticas/global').subscribe({
      next: (res) => {
        this.stats.totalTareas = res.totalTareas;
        this.stats.cuelloCritico = res.cuelloCritico;
        this.stats.mejorFuncionario = res.mejorFuncionario;
        this.rankingGlobal = res.rankingGlobal || [];
        
        const eG = (res.ejecucionPromedioGlobal / (res.ejecucionPromedioGlobal + res.esperaPromedioGlobal)) * 100;
        this.stats.eficienciaGlobal = Math.round(eG || 0);

        // RESTAURAR TRÁFICO
        this.trafficChartOptions = {
          series: [{ name: "Trámites", data: res.serieTrafico || [] }],
          chart: { height: 320, type: "area", toolbar: { show: false } },
          colors: ['#d35400'],
          stroke: { curve: 'smooth', width: 3 },
          xaxis: { 
            categories: Array.from({length: 24}, (_, i) => `${i}:00`),
            labels: { style: { colors: '#94a3b8' } } 
          },
          fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.1 } },
          theme: { mode: 'dark' }
        };

        // RESTAURAR DEPARTAMENTOS
        if (res.rendimientoDeptos && Object.keys(res.rendimientoDeptos).length > 0) {
          const deptosRaw = Object.keys(res.rendimientoDeptos);
          const labels = deptosRaw.map(d => {
            if (!d || d === 'null') return 'Indefinido';
            return d === 'GENERAL' ? 'Ventanilla' : d.toUpperCase();
          });
          
          this.deptoChartOptions = {
            series: [
              { name: "Espera (S)", data: deptosRaw.map(d => res.rendimientoDeptos[d] ? Math.round(res.rendimientoDeptos[d].espera || 0) : 0) },
              { name: "Trabajo (S)", data: deptosRaw.map(d => res.rendimientoDeptos[d] ? Math.round(res.rendimientoDeptos[d].trabajo || 0) : 0) }
            ],
            chart: { type: 'bar', height: 350, stacked: true, toolbar: { show: false } },
            plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
            colors: ['#d35400', '#27ae60'],
            xaxis: { categories: labels, labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            legend: { position: 'top', labels: { colors: '#94a3b8' } },
            dataLabels: { enabled: true, style: { fontSize: '10px' } },
            theme: { mode: 'dark' }
          };
        } else {
          // Inicialización segura si no hay datos de departamentos
          this.deptoChartOptions.series = [];
          this.deptoChartOptions.xaxis = { categories: [] };
        }

        this.isDataLoaded = true;
      },
      error: (err) => console.error("Error en analíticas:", err)
    });
  }

  formatTime(seconds: number): string {
    if (seconds === undefined || seconds === null || seconds <= 0) return '---';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    let res = '';
    if (hrs > 0) res += `${hrs}h `;
    if (mins > 0) res += `${mins}m `;
    if (secs > 0 || res === '') res += `${secs}s`;
    return res.trim();
  }

  getEspecialidades(func: any): string[] {
    return func.especialidades ? Object.keys(func.especialidades) : [];
  }

  getScore(func: any): number {
    const avg = func.promedioGlobal;
    if (!avg || avg <= 0) return 0.0;
    
    // Escala Logarítmica para Score:
    // 0-30s: 10.0
    // 5min: 9.0
    // 15min: 8.0
    // 1h: 6.0
    // +4h: 1.0
    if (avg <= 30) return 10.0;
    if (avg <= 300) return 9.0 + (1 - (avg - 30) / 270);
    if (avg <= 900) return 8.0 + (1 - (avg - 300) / 600);
    if (avg <= 3600) return 6.0 + (2 - (avg - 900) / 2700 * 2);
    
    const score = 6.0 - (avg / 3600);
    return Math.max(1.0, Math.round(score * 10) / 10);
  }

  getDeptoClass(promedio: number): string {
    if (promedio <= 600) return 'fast'; // Menos de 10 min
    if (promedio <= 1800) return 'normal'; // Menos de 30 min
    return 'slow';
  }

  getDeptoLabel(promedio: number): string {
    if (promedio <= 600) return 'Muy Eficiente';
    if (promedio <= 1800) return 'Consistente';
    return 'Cuello de Botella';
  }

  getEfficiencyLabel(score: number): string {
    if (score >= 9.0) return 'ELITE';
    if (score >= 7.5) return 'EFICIENTE';
    if (score >= 5.0) return 'ESTÁNDAR';
    if (score > 0) return 'POR MEJORAR';
    return 'SIN DATOS';
  }

  getEfficiencyClass(score: number): string {
    if (score >= 9.0) return 'elite';
    if (score >= 7.5) return 'efficient';
    if (score >= 5.0) return 'standard';
    if (score > 0) return 'low';
    return 'none';
  }
}
