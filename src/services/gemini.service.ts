import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';

export interface ValidationResponse {
  is_measurable: boolean;
  feedback: string;
}

export interface InspirationResponse {
  ideas: string[];
}

/**
 * Retrieves the API key from the environment in a way that is robust
 * against build-time static analysis and replacement.
 * This function dynamically resolves `process.env.API_KEY` at runtime.
 */
function getApiKey(): string | undefined {
  try {
    // This dynamically evaluates code to access the global scope and then `process`.
    // It's a strategy to prevent build tools from statically analyzing and potentially
    // mis-handling the `process.env` access, which appears to be the root cause
    // of the "Assignment to constant variable" error in this specific environment.
    const global = new Function('return this')();
    if (global && global.process && global.process.env) {
      return global.process.env.API_KEY;
    }
    return undefined;
  } catch (e) {
    console.error("Error dynamically accessing API_KEY:", e);
    return undefined;
  }
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    // Intentionally left blank. Client is lazy-loaded to ensure environment is ready.
  }

  private getAiClient(): GoogleGenAI | null {
    if (this.ai) {
      return this.ai;
    }

    const apiKey = getApiKey();

    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
      return this.ai;
    }
    
    console.error(
      'API_KEY environment variable not set or accessible. Gemini API calls will fail.'
    );
    return null;
  }

  async validateMeasurableQuestion(
    question: string
  ): Promise<ValidationResponse> {
    const aiClient = this.getAiClient();
    if (!aiClient) {
      return {
        is_measurable: false,
        feedback:
          'La clave de API para el servicio de IA no está configurada.',
      };
    }
    try {
      // Use ai.models.generateContent as per guidelines
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash', // Correct model
        contents: `Analiza la siguiente pregunta de investigación de un estudiante de secundaria para un proyecto de ciencias sobre el agua. Determina si es "medible", lo que significa que se puede responder recolectando datos numéricos. Proporciona una respuesta en formato JSON.

        Pregunta: "${question}"

        Tu respuesta debe ser un objeto JSON con dos claves:
        1. "is_measurable": un booleano (true si es medible, false si no lo es).
        2. "feedback": una cadena de texto corta y constructiva (en español) que explique por qué la pregunta es o no medible, y si no lo es, cómo podría mejorarla. El tono debe ser amigable y alentador para un estudiante.`,
        config: {
          responseMimeType: 'application/json', // Using JSON response
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              is_measurable: { type: Type.BOOLEAN },
              feedback: { type: Type.STRING },
            },
            required: ['is_measurable', 'feedback'],
          },
        },
      });

      // Correctly extract text and parse JSON
      const jsonString = response.text.trim();
      const result = JSON.parse(jsonString);
      return result as ValidationResponse;
    } catch (error) {
      console.error('Error validating question with Gemini:', error);
      // Return a user-friendly error response that matches the expected interface.
      return {
        is_measurable: false,
        feedback:
          '¡Uy! Hubo un problema al conectar con la IA. Inténtalo de nuevo.',
      };
    }
  }

  async getInspiration(topic: string): Promise<InspirationResponse> {
    const aiClient = this.getAiClient();
    if (!aiClient) {
      return {
        ideas: ['La clave de API para el servicio de IA no está configurada.'],
      };
    }
    try {
      // Use ai.models.generateContent as per guidelines
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash', // Correct model
        contents: `Genera 3 ideas de problemas de investigación para un proyecto de ciencias de secundaria sobre el tema: "${topic}". Las ideas deben ser preguntas simples y directas que un estudiante pueda investigar. Proporciona la respuesta en formato JSON.

        Tu respuesta debe ser un objeto JSON con una única clave: "ideas", que es un array de 3 strings, donde cada string es una idea de pregunta.`,
        config: {
          responseMimeType: 'application/json', // Using JSON response
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ideas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['ideas'],
          },
        },
      });

      // Correctly extract text and parse JSON
      const jsonString = response.text.trim();
      const result = JSON.parse(jsonString);
      return result as InspirationResponse;
    } catch (error) {
      console.error('Error getting inspiration from Gemini:', error);
      // Return a user-friendly error response that matches the expected interface.
      return {
        ideas: ['Hubo un error al buscar inspiración. ¡Inténtalo de nuevo!'],
      };
    }
  }
}