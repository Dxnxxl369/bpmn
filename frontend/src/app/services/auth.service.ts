import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, of, map, throwError, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface UserProfile {
  nombre: string;
  apellido: string;
  username: string;
  email: string;
  rol: string;
  avatar: string;
  departamentoIds?: string[];
  laneId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<UserProfile | null>(null);
  user$ = this.userSubject.asObservable();
  private apiUrl = 'http://localhost:8080/api/auth';
  private usrUrl = 'http://localhost:8080/api/usuarios';

  constructor(private router: Router, private http: HttpClient) {
    this.restoreSession();
  }

  private restoreSession() {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        this.userSubject.next(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }

  login(credentials: { email: string, password: string }): Observable<any> {
    return this.http.post<{token: string}>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        localStorage.setItem('token', res.token);
      }),
      switchMap(res => this.http.get<any>(`${this.usrUrl}/me?email=${credentials.email}`)),
      tap(user => {
        const profile: UserProfile = {
          nombre: user.nombre,
          apellido: user.apellido || '',
          username: user.username || user.email.split('@')[0],
          email: user.email,
          rol: user.rol,
          avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
          departamentoIds: user.departamentoIds || [],
          laneId: user.laneId
        };
        localStorage.setItem('user', JSON.stringify(profile));
        this.userSubject.next(profile);
      })
    );
  }

  updateProfile(data: Partial<UserProfile>) {
    const current = this.userSubject.value;
    if (current) {
      const updated = { ...current, ...data };
      return this.http.put<any>(`${this.usrUrl}/update`, updated).pipe(
        tap(userFromServer => {
          const profile: UserProfile = {
            nombre: userFromServer.nombre,
            apellido: userFromServer.apellido || '',
            username: userFromServer.username || '',
            email: userFromServer.email,
            rol: userFromServer.rol,
            avatar: userFromServer.avatar || current.avatar,
            departamentoIds: userFromServer.departamentoIds || current.departamentoIds,
            laneId: userFromServer.laneId || current.laneId
          };
          localStorage.setItem('user', JSON.stringify(profile));
          this.userSubject.next(profile);
        })
      );
    }
    return throwError(() => new Error('No hay sesión activa'));
  }

  hasPermission(permission: string): boolean {
    const rol = this.getRol();
    if (rol === 'ADMINISTRADOR') return true;
    return permission === 'VIEW_PALETTE';
  }

  getNombre(): string { return this.userSubject.value?.nombre || 'Usuario'; }
  getNombreCompleto(): string { 
    const u = this.userSubject.value;
    if (!u) return 'Usuario';
    return `${u.nombre} ${u.apellido}`.trim(); 
  }
  getEmail(): string { return this.userSubject.value?.email || ''; }
  getAvatar(): string { return this.userSubject.value?.avatar || ''; }
  getRol(): string { return this.userSubject.value?.rol || ''; }

  logout() {
    localStorage.clear();
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean { return this.userSubject.value !== null; }
}
