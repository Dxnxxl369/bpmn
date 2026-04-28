import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewEncapsulation, Optional, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  pattern?: string;
  errorMessage?: string;
}

@Component({
  selector: 'app-formulario-dinamico',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule, 
    MatButtonModule, MatIconModule
  ],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './formulario-dinamico.component.html',
  styleUrls: ['./formulario-dinamico.component.css']
})
export class FormularioDinamicoComponent implements OnInit, OnChanges {
  @Input() schema: string = '[]';
  @Input() initialData: any = null;
  @Input() highlightId: string | null = null;
  @Output() submitted = new EventEmitter<any>();
  @Output() fieldHovered = new EventEmitter<string | null>();

  fields: FormField[] = [];
  form: FormGroup = new FormGroup({});
  fileName: { [key: string]: string } = {};

  constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: any) {
    if (this.data && this.data.schema) {
      this.schema = this.data.schema;
    }
  }

  ngOnInit() { this.rebuildForm(); }

  getContextValue(key: string): string {
    if (!this.data?.instancia?.contextoJson) return '';
    try {
      const ctx = JSON.parse(this.data.instancia.contextoJson);
      const searchKey = key.toLowerCase().replace(" ", "");

      // 1. INTENTO: Buscar en las llaves globales fijadas por el backend (ci_global, email_global, etc)
      if (ctx[key + "_global"]) return ctx[key + "_global"];

      // 2. INTENTO: Búsqueda flexible por subcadena
      const foundKey = Object.keys(ctx).find(k => {
        const normalizedK = k.toLowerCase().replace(" ", "");
        return normalizedK.includes(searchKey) || searchKey.includes(normalizedK);
      });

      return foundKey ? ctx[foundKey] : '';
    } catch (e) {
      return '';
    }
  }

  hasCustomButtons(): boolean {
    return this.fields.some(f => f.type === 'button');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['schema']) {
      this.rebuildForm();
    }
    if (changes['initialData'] && this.initialData) {
      this.form.patchValue(this.initialData);
    }
  }

  private rebuildForm() {
    try {
      this.fields = JSON.parse(this.schema || '[]');
      const group: any = {};
      this.fields.forEach(field => {
        // SANITIZACIÓN: Asegurarnos de que las opciones sean solo strings (por el enrutamiento)
        if (field.options && Array.isArray(field.options)) {
          field.options = field.options.map(opt => {
            if (typeof opt === 'object' && opt !== null) {
              return (opt as any).condicion || JSON.stringify(opt);
            }
            return String(opt);
          });
        }

        if (field.type !== 'button') {
          const validators = [];
          if (field.required) validators.push(Validators.required);
          if (field.pattern) validators.push(Validators.pattern(field.pattern));
          
          group[field.id] = new FormControl('', validators);
        }
      });
      this.form = new FormGroup(group);
    } catch (e) {
      this.fields = [];
    }
  }

  onFileChange(event: any, fieldId: string) {
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      this.fileName[fieldId] = file.name;
      this.form.patchValue({ [fieldId]: file });
    }
  }

  onSubmit() {
    console.log("Intentando enviar formulario...", this.form.value);
    if (this.form.valid) {
      console.log("Formulario válido. Emitiendo datos...");
      this.submitted.emit(this.form.value);
    } else {
      console.warn("Formulario INVÁLIDO. Campos con error:");
      Object.keys(this.form.controls).forEach(key => {
        const controlErrors = this.form.get(key)?.errors;
        if (controlErrors != null) {
          console.error(`Campo '${key}':`, controlErrors);
        }
      });
      this.form.markAllAsTouched();
    }
  }
}
