import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  ngOnInit() {
    // Forzar dark-mode por defecto para mantener la estética SaaS Premium
    if (!document.body.classList.contains('dark-mode')) {
      document.body.classList.add('dark-mode');
    }
  }
}
