import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-publish-result-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, RouterModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './publish-result-dialog.component.html',
  styleUrls: ['./publish-result-dialog.component.css']
})
export class PublishResultDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PublishResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { report: any }
  ) {}
}
