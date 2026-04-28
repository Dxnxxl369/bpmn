import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { FuncionarioMonitorComponent } from './components/funcionario-monitor/funcionario-monitor.component';
import { AdminShellComponent } from './layout/admin-shell/admin-shell.component';
import { DesignerViewComponent } from './modules/designer/designer-view/designer-view.component';
import { DepartmentManagerComponent } from './modules/departments/department-manager/department-manager.component';
import { ExecutiveCastingComponent } from './modules/executives/executive-casting/executive-casting.component';
import { ProcessMonitorComponent } from './modules/monitor/process-monitor/process-monitor.component';
import { ProfileComponent } from './components/profile/profile.component';
import { GlobalAnalyticsComponent } from './components/global-analytics/global-analytics.component';

import { PortalShellComponent } from './modules/portal/portal-shell/portal-shell.component';
import { PortalCatalogComponent } from './modules/portal/portal-catalog/portal-catalog.component';
import { PortalTrackingComponent } from './modules/portal/portal-tracking/portal-tracking.component';

import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'portal',
    component: PortalShellComponent,
    children: [
      { path: '', component: PortalCatalogComponent },
      { path: 'seguimiento/:token', component: PortalTrackingComponent }
    ]
  },
  { 
    path: 'admin', 
    component: AdminShellComponent, 
    canActivate: [authGuard], 
    data: { rol: 'ADMINISTRADOR' },
    children: [
      { path: '', redirectTo: 'designer', pathMatch: 'full' },
      { path: 'designer', component: DesignerViewComponent },
      { path: 'departments', component: DepartmentManagerComponent },
      { path: 'executives', component: ExecutiveCastingComponent },
      { path: 'monitor', component: ProcessMonitorComponent },
      { path: 'reports', component: GlobalAnalyticsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'monitor-ejecutivo', component: FuncionarioMonitorComponent }
    ]
  },
  { 
    path: 'funcionario', 
    component: AdminShellComponent, // Usamos el mismo Shell
    canActivate: [authGuard], 
    data: { rol: 'FUNCIONARIO' },
    children: [
      { path: '', redirectTo: 'monitor-ejecutivo', pathMatch: 'full' },
      { path: 'monitor-ejecutivo', component: FuncionarioMonitorComponent },
      { path: 'profile', component: ProfileComponent }
    ]
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
