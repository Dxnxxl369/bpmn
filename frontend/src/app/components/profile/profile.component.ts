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
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;
  profileForm: FormGroup;
  currentName = ''; userRole = ''; userEmail = ''; avatarPreview = ''; saving = false;
  myDepartments: any[] = [];
  originalUserData: any = null;

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
      email: [{ value: '', disabled: true }] // Sin validadores y deshabilitado para que no estorbe
    });
  }

  ngOnInit() {
    this.authService.user$.subscribe((user: any) => {
      if (user) {
        console.log(">> [PERFIL] Datos cargados:", user.email);
        this.originalUserData = { ...user };
        this.updateLocalState(user);
      }
    });
  }

  private updateLocalState(user: any) {
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
    if (user.departamentoIds?.length > 0) {
       this.bpmsService.listarDepartamentos().subscribe(all => {
          this.myDepartments = all.filter(d => user.departamentoIds.includes(d.id!));
          this.cdr.detectChanges();
       });
    }
  }

  triggerFile() { this.fileInput.nativeElement.click(); }
  
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        this.snackBar.open('⚠️ La imagen es demasiado pesada (máx 1.5MB). Elige una más pequeña.', 'Cerrar', { duration: 5000 });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e: any) => { 
        this.avatarPreview = e.target.result; 
        console.log(">> [PERFIL] Foto seleccionada (base64 length):", this.avatarPreview.length);
        this.cdr.detectChanges(); 
      };
      reader.readAsDataURL(file);
    }
  }

  selectAvatar(url: string) { 
    this.avatarPreview = url; 
    this.cdr.detectChanges(); 
  }

  resetForm() {
    if (this.originalUserData) {
        this.updateLocalState(this.originalUserData);
        this.snackBar.open('Cambios descartados.', 'OK', { duration: 2000 });
    }
  }

  saveProfile() {
    console.log(">> [PERFIL] Click en guardar");
    if (this.profileForm.invalid) {
      this.snackBar.open('⚠️ Por favor, llena todos los campos correctamente.', 'OK');
      return;
    }

    this.saving = true;
    const profileData = {
      nombre: this.profileForm.value.nombre.toUpperCase(),
      apellido: this.profileForm.value.apellido.toUpperCase(),
      username: this.profileForm.value.username,
      avatar: this.avatarPreview,
      email: this.userEmail
    };

    console.log(">> [PERFIL] Enviando datos a AuthService...");
    this.authService.updateProfile(profileData).subscribe({
      next: (res) => {
        this.saving = false;
        console.log("✅ [PERFIL] Respuesta exitosa del servidor");
        this.snackBar.open('✅ Perfil y foto actualizados con éxito.', 'OK', { duration: 4000 });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        console.error('❌ [PERFIL] Error al guardar:', err);
        const msg = err.status === 413 ? '❌ Foto demasiado pesada para el servidor.' : '❌ Error al guardar perfil.';
        this.snackBar.open(msg, 'Cerrar', { duration: 6000 });
      }
    });
  }
}
