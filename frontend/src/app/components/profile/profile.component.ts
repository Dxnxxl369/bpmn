import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { BpmsService } from '../../services/bpms.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatCardModule, 
    MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule, MatSnackBarModule
  ],
  template: `
    <div class="profile-container animate-fade-in">
      <header class="profile-header">
        <div class="badge-premium">IDENTIDAD DIGITAL</div>
        <h1>Mi <span>Perfil</span></h1>
        <p class="text-muted">Gestiona tu información y revisa tus áreas de responsabilidad.</p>
      </header>

      <div class="profile-grid">
        <aside class="profile-sidebar glass-panel">
          <div class="avatar-box">
             <div class="avatar-ring clickable" (click)="triggerFile()">
                <img [src]="avatarPreview || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'" alt="Avatar">
                <div class="role-badge-float">{{ userRole }}</div>
                <div class="avatar-overlay"><mat-icon>camera_alt</mat-icon></div>
             </div>
             <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/*" style="display: none">
             <h3>{{ currentName }}</h3>
             <span class="email-text">{{ userEmail }}</span>

             <!-- GALERÍA DE AVATARES -->
             <div class="avatar-gallery-box">
                <p class="box-title">O ELIGE UN AVATAR PREMIUM</p>
                <div class="avatar-options scroll-custom-mini">
                   <div *ngFor="let av of predefinedAvatars" 
                        class="av-opt" 
                        [class.selected]="avatarPreview === av"
                        (click)="selectAvatar(av)">
                      <img [src]="av">
                   </div>
                </div>
             </div>
          </div>

          <div class="responsibilities-box">
             <h4 class="box-title">AREAS DE RESPONSABILIDAD</h4>
             <div class="dept-list scroll-custom-mini">
                <div class="dept-item-pro" *ngFor="let dept of myDepartments">
                   <mat-icon>verified_user</mat-icon>
                   <div class="dept-info">
                      <strong>{{ dept.nombreNormalizado }}</strong>
                      <small>Acceso Total</small>
                   </div>
                </div>
                <div class="empty-msg" *ngIf="myDepartments.length === 0">
                   <mat-icon>info</mat-icon>
                   <p>No tienes departamentos asignados aún.</p>
                </div>
             </div>
          </div>
        </aside>

        <main class="profile-main glass-panel">
           <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="main-form">
              <h2 class="form-title"><mat-icon>settings</mat-icon> Datos Personales</h2>
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Nombre</mat-label>
                  <input matInput formControlName="nombre">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Apellido</mat-label>
                  <input matInput formControlName="apellido">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Nombre de Usuario</mat-label>
                  <input matInput formControlName="username">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput formControlName="email" readonly>
                </mat-form-field>
              </div>
              <button type="submit" class="btn-save-pro" [disabled]="profileForm.invalid || saving">
                <mat-icon>{{ saving ? 'sync' : 'save' }}</mat-icon>
                {{ saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS' }}
              </button>
           </form>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .profile-container { padding: 40px; max-width: 1300px; margin: 0 auto; height: 100%; overflow-y: auto; }
    .profile-header { text-align: center; margin-bottom: 50px; }
    .badge-premium { display: inline-block; padding: 6px 18px; background: rgba(211, 84, 0, 0.1); color: var(--primary-color); border-radius: 50px; font-size: 0.65rem; font-weight: 950; letter-spacing: 2px; margin-bottom: 15px; border: 1px solid rgba(211, 84, 0, 0.2); }
    h1 { font-size: 3rem; font-weight: 950; margin: 0; color: var(--text-main); }
    h1 span { color: var(--primary-color); }
    
    .profile-grid { display: grid; grid-template-columns: 420px 1fr; gap: 30px; }
    .glass-panel { background: var(--surface); border-radius: 35px; border: 1px solid var(--glass-border); padding: 40px; }
    
    .avatar-box { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid var(--glass-border); }
    .avatar-ring { 
      width: 140px; height: 140px; margin: 0 auto 20px; border-radius: 40px; 
      border: 4px solid var(--primary-color); position: relative; padding: 5px;
      box-shadow: 0 15px 35px rgba(211, 84, 0, 0.3); transition: 0.3s;
    }
    .avatar-ring.clickable { cursor: pointer; }
    .avatar-ring.clickable:hover { transform: scale(1.05); }
    .avatar-ring img { width: 100%; height: 100%; border-radius: 35px; object-fit: cover; }
    
    .avatar-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.4); border-radius: 35px;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: 0.3s;
    }
    .avatar-ring:hover .avatar-overlay { opacity: 1; }
    .avatar-overlay mat-icon { color: white; font-size: 30px; width: 30px; height: 30px; }

    /* GALERÍA */
    .avatar-gallery-box { margin-top: 30px; text-align: left; }
    .avatar-options { display: flex; gap: 10px; overflow-x: auto; padding: 10px 0; }
    .av-opt { width: 60px; height: 60px; border-radius: 15px; border: 2px solid transparent; cursor: pointer; transition: 0.2s; flex-shrink: 0; }
    .av-opt img { width: 100%; height: 100%; border-radius: 12px; }
    .av-opt.selected { border-color: var(--primary-color); transform: scale(1.1); box-shadow: 0 5px 15px rgba(211, 84, 0, 0.3); }

    .role-badge-float { position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); background: #000; color: var(--primary-color); padding: 4px 15px; border-radius: 50px; font-size: 0.6rem; font-weight: 950; border: 1px solid var(--primary-color); z-index: 10; }
    
    .box-title { font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; }
    .dept-list { display: flex; flex-direction: column; gap: 12px; max-height: 250px; }
    .dept-item-pro { display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.03); padding: 12px 18px; border-radius: 18px; border: 1px solid var(--glass-border); }
    .dept-info strong { display: block; font-size: 0.85rem; color: var(--text-main); font-weight: 800; }
    .dept-info small { font-size: 0.65rem; color: var(--primary-color); font-weight: 700; text-transform: uppercase; }

    .btn-save-pro { width: 100%; height: 60px; border-radius: 18px; border: none; background: linear-gradient(135deg, var(--primary-color), #e67e22); color: white !important; font-weight: 950; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: 0.4s; }
    .btn-save-pro:hover:not(:disabled) { transform: translateY(-5px); }

    .animate-fade-in { animation: fadeIn 0.6s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;
  profileForm: FormGroup;
  currentName = '';
  userRole = '';
  userEmail = '';
  avatarPreview = '';
  saving = false;
  myDepartments: any[] = [];

  predefinedAvatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Toby',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella'
  ];

  constructor(private fb: FormBuilder, private authService: AuthService, private bpmsService: BpmsService, private snackBar: MatSnackBar, private cdr: ChangeDetectorRef) {
    this.profileForm = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  triggerFile() { this.fileInput.nativeElement.click(); }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => { this.avatarPreview = e.target.result; this.cdr.detectChanges(); };
      reader.readAsDataURL(file);
    }
  }

  selectAvatar(url: string) {
    this.avatarPreview = url;
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.authService.user$.subscribe((user: any) => {
      if (user) {
        this.currentName = `${user.nombre} ${user.apellido}`;
        this.userRole = user.rol;
        this.userEmail = user.email;
        this.avatarPreview = user.avatar;
        this.profileForm.patchValue({
          nombre: user.nombre,
          apellido: user.apellido,
          username: user.username,
          email: user.email
        });

        if (user.departamentoIds && user.departamentoIds.length > 0) {
           this.bpmsService.listarDepartamentos().subscribe(all => {
              this.myDepartments = all.filter(d => user.departamentoIds.includes(d.id!));
              this.cdr.detectChanges();
           });
        }
      }
    });
  }

  saveProfile() {
    this.saving = true;
    const profileData = {
      nombre: this.profileForm.value.nombre.toUpperCase(),
      apellido: this.profileForm.value.apellido.toUpperCase(),
      username: this.profileForm.value.username,
      avatar: this.avatarPreview,
      email: this.userEmail
    };

    this.authService.updateProfile(profileData).subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open('✅ Perfil actualizado.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.saving = false;
        this.snackBar.open('❌ Error al guardar.', 'Cerrar', { duration: 5000 });
      }
    });
  }
}
