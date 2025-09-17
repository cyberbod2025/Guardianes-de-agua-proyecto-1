import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService, ValidationResponse } from './services/gemini.service';
import { StateService } from './services/state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="bg-blue-50 min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <div class="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8">
        <header class="text-center mb-8">
          <h1 class="text-4xl font-bold text-blue-800">Guardián del Agua</h1>
          <p class="text-lg text-gray-600 mt-2">¡Tu misión es hacer preguntas medibles sobre el agua!</p>
        </header>

        <div class="space-y-4">
          <label for="question-input" class="block text-lg font-medium text-gray-700">Tu Pregunta de Misión:</label>
          <textarea
            id="question-input"
            [value]="question()"
            (input)="onQuestionInput($event)"
            rows="3"
            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            placeholder="Ej: ¿Cuántos litros de agua se usan para producir 1kg de carne?"></textarea>

          <button
            (click)="validateQuestion()"
            [disabled]="isLoading() || !question().trim()"
            class="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-300 flex items-center justify-center text-lg">
            @if (isLoading()) {
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Validando...</span>
            } @else {
              <span>¡Validar Pregunta!</span>
            }
          </button>
        </div>

        @if (validationResponse(); as response) {
          <div 
            class="mt-6 p-4 rounded-lg border"
            [class.bg-green-100]="response.is_measurable"
            [class.text-green-800]="response.is_measurable"
            [class.border-green-400]="response.is_measurable"
            [class.bg-yellow-100]="!response.is_measurable"
            [class.text-yellow-800]="!response.is_measurable"
            [class.border-yellow-400]="!response.is_measurable">
            <p class="font-semibold">{{ response.feedback }}</p>
          </div>
        }

        @if (approvedQuestions().length > 0) {
          <div class="mt-8">
            <h2 class="text-2xl font-bold text-blue-700 mb-4">Preguntas Aprobadas</h2>
            <ul class="list-disc list-inside space-y-2 bg-gray-50 p-4 rounded-lg">
              @for (q of approvedQuestions(); track q) {
                <li class="text-gray-800">{{ q }}</li>
              }
            </ul>
          </div>
        }
      </div>
    </main>
  `,
  styles: [
    `
    /* Using Tailwind via CDN, so no custom CSS is strictly needed here. */
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly geminiService = inject(GeminiService);
  private readonly stateService = inject(StateService);

  question = signal('');
  validationResponse = signal<ValidationResponse | null>(null);
  isLoading = signal(false);

  approvedQuestions = this.stateService.approvedQuestions;

  onQuestionInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.question.set(target.value);
    this.validationResponse.set(null);
  }

  async validateQuestion() {
    const currentQuestion = this.question().trim();
    if (!currentQuestion) {
      return;
    }
    this.isLoading.set(true);
    this.validationResponse.set(null);
    try {
      const response = await this.geminiService.validateMeasurableQuestion(currentQuestion);
      this.validationResponse.set(response);
      if (response.is_measurable) {
        this.stateService.addApprovedQuestion(currentQuestion);
        this.question.set(''); // Clear input on success
      }
    } catch (error) {
      console.error('Error validating question:', error);
      this.validationResponse.set({
        is_measurable: false,
        feedback: '¡Uy! Algo salió mal. Por favor, inténtalo de nuevo.',
      });
    } finally {
      this.isLoading.set(false);
    }
  }
}
