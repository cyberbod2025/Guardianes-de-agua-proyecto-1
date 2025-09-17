
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { environment } from '../environments/environment';

export interface ValidationResponse {
    is_measurable: boolean;
    feedback: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // The API key is sourced from an environment variable, as per instructions.
    // In a real build process, this would be replaced.
    const apiKey = (process.env as any).API_KEY; 
    if (!apiKey) {
        console.warn("API_KEY environment variable not set. Gemini Service will not function.");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || 'mock_key_for_dev_only' });
  }

  async validateMeasurableQuestion(question: string): Promise<ValidationResponse> {
    if (!(process.env as any).API_KEY) {
        console.log("Mocking Gemini response because API key is not available.");
        // Mock response for development without a key
        if (question.match(/\d|cuánto|cuántos|cuántas|porcentaje|qué tan/i)) {
            return { is_measurable: true, feedback: "¡Pregunta Aprobada! ¡Esa pregunta está con todo! ¡Bien pensado, Guardianes!" };
        } else {
            return { is_measurable: false, feedback: "¡Casi! Esa pregunta es genial, pero... ¿cómo la MEDIMOS? Intenta de nuevo usando palabras como 'Cuántos' o 'Qué tan rápido'. ¡Échenle coco!" };
        }
    }
      
    const model = 'gemini-2.5-flash';
    const systemInstruction = `Eres "El guardián del agua", un guía de misión ingenioso y motivador para estudiantes de secundaria mexicanos. Tu tono es enérgico, usas modismos mexicanos y eres un bromista nato. Analiza la pregunta del estudiante. Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura: {"is_measurable": boolean, "feedback": string}.
- Si la pregunta es medible (contiene o implica números, porcentajes, mediciones, tiempo, etc.), asigna 'is_measurable' a true. El 'feedback' debe ser una felicitación entusiasta en español mexicano.
- Si la pregunta NO es medible, asigna 'is_measurable' a false. El 'feedback' debe ser una guía socrática, sin dar la respuesta, para que reformulen la pregunta usando términos medibles. ¡No seas aburrido!`;
    
    // FIX: The 'required' property is not a documented field for the responseSchema in @google/genai.
    // Removing it to rely on the model following the prompt instructions for JSON structure.
    const schema = {
        type: Type.OBJECT,
        properties: {
            is_measurable: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
        }
    };

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: question,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: schema
        }
      });

      const jsonString = response.text;
      const parsedResponse = JSON.parse(jsonString) as ValidationResponse;
      return parsedResponse;

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return {
        is_measurable: false,
        feedback: '¡Uy, parece que mis circuitos se mojaron! Hubo un error. Intenta de nuevo o revisa tu pregunta.',
      };
    }
  }
}
