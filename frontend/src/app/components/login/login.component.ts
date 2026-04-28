import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatTooltipModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  hide = true;
  isDarkMode = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.isDarkMode = document.body.classList.contains('dark-mode');
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }

  onSubmit() {
    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        const rol = this.authService.getRol();
        if (rol === 'ADMINISTRADOR') this.router.navigate(['/admin']);
        else this.router.navigate(['/funcionario']);
      },
      error: () => alert('Credenciales incorrectas.')
    });
  }
}
