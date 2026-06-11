import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HttpClient } from '@angular/common/http';
import { NgApexchartsModule, ChartComponent, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle, ApexDataLabels, ApexYAxis, ApexLegend, ApexPlotOptions, ApexTooltip, ApexTheme, ApexFill } from "ng-apexcharts";

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title: ApexTitleSubtitle;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  legend: ApexLegend;
  tooltip: ApexTooltip;
  theme: ApexTheme;
  fill: ApexFill;
};

@Component({
  selector: 'app-analiticas-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatProgressBarModule, MatIconModule, MatButtonModule, NgApexchartsModule],
  templateUrl: './analiticas-dashboard.component.html',
  styleUrls: ['./analiticas-dashboard.component.css']
})
export class AnaliticasDashboardComponent implements OnInit {
  @Input() politicaId!: string;
  @ViewChild("chart") chart!: ChartComponent;

  public deptoChartOptions!: Partial<ChartOptions>;
  public rankingChartOptions!: Partial<ChartOptions>;

  tiempos: any[] = [];
  ranking: any[] = [];
  metricasDeptos: any = {};
  reporteIA: string = '';
  cargandoIA: boolean = false;

  private apiUrl = 'http://localhost:8080/api/analiticas';

  constructor(private http: HttpClient) {
    this.initCharts();
  }

  ngOnInit(): void {
    if (this.politicaId) {
      this.cargarDatos();
    }
  }

  initCharts() {
    this.deptoChartOptions = {
      chart: { type: "bar", height: 350, stacked: true, toolbar: { show: false }, background: 'transparent' },
      theme: { mode: 'dark', palette: 'palette1' },
      plotOptions: { bar: { horizontal: true, barHeight: '50%' } },
      series: [],
      xaxis: { categories: [] },
      fill: { opacity: 1 },
      legend: { position: 'top' }
    };

    this.rankingChartOptions = {
      chart: { type: "bar", height: 350, toolbar: { show: false }, background: 'transparent' },
      theme: { mode: 'dark' },
      plotOptions: { bar: { columnWidth: '40%', distributed: true } },
      series: [],
      xaxis: { categories: [] },
      legend: { show: false }
    };
  }

  cargarDatos() {
    // 1. Tiempos por Nodo
    this.http.get<any>(`${this.apiUrl}/${this.politicaId}/tiempos-por-nodo`).subscribe(data => {
      this.tiempos = Object.entries(data).map(([nombre, promedio]) => ({ nombre, promedio }));
    });

    // 2. Ranking de Funcionarios
    this.http.get<any[]>(`${this.apiUrl}/${this.politicaId}/ranking-funcionarios`).subscribe(data => {
      this.ranking = data;
      this.rankingChartOptions.series = [{
        name: "Segundos de ejecución",
        data: data.map(r => r.promedioEjecucion)
      }];
      this.rankingChartOptions.xaxis = { categories: data.map(r => r.nombre) };
    });

    // 3. Métricas por Departamento (Cuellos de Botella)
    this.http.get<any>(`${this.apiUrl}/${this.politicaId}/departamentos`).subscribe(data => {
      this.metricasDeptos = data;
      const deptos = Object.keys(data);
      
      this.deptoChartOptions.series = [
        { name: "Tiempo Espera (Cuello Botella)", data: deptos.map(d => data[d].esperaPromedio), color: '#d35400' },
        { name: "Tiempo Ejecución (Eficiencia)", data: deptos.map(d => data[d].ejecucionPromedio), color: '#27ae60' }
      ];
      this.deptoChartOptions.xaxis = { categories: deptos };
    });
  }

  generarAnalisisIA() {
    this.cargandoIA = true;
    this.http.get<any>(`${this.apiUrl}/${this.politicaId}/resumen`).subscribe(res => {
      this.reporteIA = res.analisis;
      this.cargandoIA = false;
    });
  }

  getMaxTiempo(): number {
    return Math.max(...this.tiempos.map(t => t.promedio), 1);
  }
}
