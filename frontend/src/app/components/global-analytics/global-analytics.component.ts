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
  backlogDeptos: any[] = [];
  isDataLoaded = false;

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

  cargarDatos() {
    this.http.get<any>('http://localhost:8080/api/analiticas/global').subscribe({
      next: (res) => {
        this.stats.totalTareas = res.totalTareas;
        this.stats.cuelloCritico = res.cuelloCritico;
        this.stats.mejorFuncionario = res.mejorFuncionario;
        this.rankingGlobal = res.rankingGlobal || [];
        
        if (res.saturacionActual) {
          this.backlogDeptos = Object.values(res.saturacionActual);
        }
        
        const eG = (res.ejecucionPromedioGlobal / (res.ejecucionPromedioGlobal + res.esperaPromedioGlobal)) * 100;
        this.stats.eficienciaGlobal = Math.round(eG || 0);

        this.trafficChartOptions = {
          series: [{ name: "Trámites", data: res.serieTrafico || [] }],
          chart: { height: 320, type: "area", toolbar: { show: false } },
          colors: ['#d35400'],
          stroke: { curve: 'smooth', width: 3 },
          xaxis: { categories: Array.from({length: 24}, (_, i) => `${i}:00`), labels: { style: { colors: '#94a3b8' } } },
          fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.1 } },
          theme: { mode: 'dark' }
        };

        if (res.rendimientoDeptos && Object.keys(res.rendimientoDeptos).length > 0) {
          const deptosRaw = Object.keys(res.rendimientoDeptos);
          this.deptoChartOptions = {
            series: [
              { name: "Espera (S)", data: deptosRaw.map(d => Math.round(res.rendimientoDeptos[d].espera || 0)) },
              { name: "Trabajo (S)", data: deptosRaw.map(d => Math.round(res.rendimientoDeptos[d].trabajo || 0)) }
            ],
            chart: { type: 'bar', height: 350, stacked: true, toolbar: { show: false } },
            plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
            colors: ['#d35400', '#27ae60'],
            xaxis: { categories: deptosRaw.map(d => d.toUpperCase()), labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            legend: { position: 'top', labels: { colors: '#94a3b8' } },
            theme: { mode: 'dark' }
          };
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

  getScore(func: any): number {
    const avg = func.promedioGlobal;
    if (!avg || avg <= 0) return 0.0;
    
    let score = 0;
    if (avg <= 30) score = 10.0;
    else if (avg <= 300) score = 9.0 + (1 - (avg - 30) / 270);
    else if (avg <= 900) score = 8.0 + (1 - (avg - 300) / 600);
    else if (avg <= 3600) score = 6.0 + (2 - (avg - 900) / 2700 * 2);
    else score = Math.max(1.0, 6.0 - (avg / 3600));

    return Math.round(score * 10) / 10; // TRUNCADO A 1 DECIMAL
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
