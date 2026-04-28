import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AiContext {
  id?: string;
  name: string;
  manual?: string;
  xml?: string;
  mode: 'guia' | 'diseno';
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private contextSubject = new BehaviorSubject<AiContext>({ name: 'General', mode: 'guia' });
  currentContext$ = this.contextSubject.asObservable();
  
  // CANAL PARA ACTUALIZAR FORMULARIOS DESDE EL CHAT
  private formUpdateSubject = new BehaviorSubject<string | null>(null);
  formUpdate$ = this.formUpdateSubject.asObservable();

  private manualContext: string = ''; // PERSISTENCIA DEL MANUAL

  setContext(context: AiContext) {
    this.contextSubject.next(context);
    if (context.manual) this.manualContext = context.manual;
  }

  // DISPARAR CAMBIOS AL DISEÑADOR
  emitFormUpdate(schemaJson: string) {
    this.formUpdateSubject.next(schemaJson);
  }

  setManualContext(text: string) { this.manualContext = text; }
  getManualContext(): string { return this.manualContext; }

  resetContext() {
    this.contextSubject.next({ name: 'General', mode: 'guia' });
    this.manualContext = '';
  }
}
