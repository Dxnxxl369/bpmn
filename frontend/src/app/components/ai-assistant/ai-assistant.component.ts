import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { AiAssistantService, AiContext } from '../../services/ai-assistant.service';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  time: Date;
  schemaAction?: string;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, MatIconModule, MatButtonModule, MatTooltipModule, MatChipsModule],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css']
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  isOpen = false;
  isTyping = false;
  isAtLeft = false;
  isListening = false; // ESTADO DEL MICROFONO
  selectedMode: 'guia' | 'diseno' = 'guia';
  selectedStyle: 'breve' | 'profundo' = 'breve';
  contextName = 'General';
  currentInput = '';
  bubblePosition = { x: window.innerWidth - 90, y: window.innerHeight - 100 };
  chatTopOffset = 0;

  // RECONOCIMIENTO DE VOZ
  private recognition: any;

  messages: Message[] = [
    { role: 'assistant', content: '¡Hola! Soy tu asistente global. ¿En qué puedo ayudarte hoy?', time: new Date() }
  ];

  private sub?: Subscription;

  constructor(public cdr: ChangeDetectorRef, private aiService: AiAssistantService, private http: HttpClient) {
    this.initVoiceRecognition();
  }

  initVoiceRecognition() {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'es-ES';

      this.recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        this.currentInput = transcript;
        this.cdr.detectChanges();
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.cdr.detectChanges();
      };

      this.recognition.onerror = () => {
        this.isListening = false;
        this.cdr.detectChanges();
      };
    }
  }

  toggleListening() {
    if (!this.recognition) {
      alert("El reconocimiento de voz no es compatible con este navegador.");
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.isListening = true;
      this.recognition.start();
    }
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.sub = this.aiService.currentContext$.subscribe(ctx => {
      this.contextName = ctx.name;
      this.selectedMode = ctx.mode;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  toggleChat(event?: Event) { 
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.calculateChatPosition();
    }
    this.cdr.detectChanges();
  }

  calculateChatPosition() {
    const bubbleY = this.bubblePosition.y;
    const chatHeight = 600;
    const windowHeight = window.innerHeight;
    let idealTop = (30 - (chatHeight / 2));
    const absoluteTop = bubbleY + idealTop;

    if (absoluteTop < 20) this.chatTopOffset = 20 - bubbleY;
    else if (absoluteTop + chatHeight > windowHeight - 20) this.chatTopOffset = (windowHeight - chatHeight - 20) - bubbleY;
    else this.chatTopOffset = idealTop;
    
    this.cdr.detectChanges();
  }

  setMode(mode: 'guia' | 'diseno') { this.selectedMode = mode; this.cdr.detectChanges(); }

  handleDragEnd(event: CdkDragEnd) {
    const rect = event.source.getRootElement().getBoundingClientRect();
    const windowWidth = window.innerWidth;
    if (rect.left + rect.width / 2 < windowWidth / 2) {
      this.isAtLeft = true;
      this.bubblePosition = { x: 30, y: rect.top };
    } else {
      this.isAtLeft = false;
      this.bubblePosition = { x: windowWidth - 90, y: rect.top };
    }
    event.source.reset();
    if (this.isOpen) this.calculateChatPosition();
    this.cdr.detectChanges();
  }

  aplicarSugerencia(json: string) {
    this.aiService.emitFormUpdate(json);
  }

  sendMessage() {
    if (!this.currentInput || this.isTyping) return;
    const userText = this.currentInput;
    this.messages.push({ role: 'user', content: userText, time: new Date() });
    this.currentInput = '';
    this.isTyping = true;
    this.cdr.detectChanges();

    const body = {
      pregunta: userText,
      modo: this.selectedMode,
      contexto: this.contextName,
      manual: this.aiService.getManualContext(),
      estilo: this.selectedStyle
    };

    this.http.post<any>('http://localhost:8080/api/ia/chat-asistente', body).subscribe({
      next: (res: any) => {
        this.isTyping = false;
        let rawContent = res.respuesta;
        let extractedSchema = null;
        const match = rawContent.match(/<schema>([\s\S]*?)<\/schema>/);
        if (match) {
          extractedSchema = match[1].trim();
          rawContent = rawContent.replace(/<schema>[\s\S]*?<\/schema>/, '').trim();
        }
        this.messages.push({ 
          role: 'assistant', 
          content: rawContent || 'He generado una propuesta de diseno para ti:', 
          time: new Date(),
          schemaAction: extractedSchema 
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isTyping = false;
        this.messages.push({ role: 'assistant', content: 'Lo siento, tuve un problema de conexión. ¿Puedes repetir?', time: new Date() });
        this.cdr.detectChanges();
      }
    });
  }
}
