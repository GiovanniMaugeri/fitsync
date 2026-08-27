import { Injectable } from '@angular/core';

export interface RecognizedFoodItem {
  name: string;
  estimated_grams: number;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

export type MealPhotoErrorKind = 'offline' | 'rate_limited' | 'server' | 'invalid_response';

export class MealPhotoAiError extends Error {
  constructor(public kind: MealPhotoErrorKind, message: string) {
    super(message);
  }
}

/**
 * Chiama la Vercel Serverless Function /api/analyze-meal-photo (che a sua volta
 * chiama Gemini) — la chiave AI resta sempre lato server, mai nel client.
 */
@Injectable({
  providedIn: 'root'
})
export class MealPhotoAiService {
  async analyzeMealPhoto(base64: string, mimeType: string): Promise<RecognizedFoodItem[]> {
    if (!navigator.onLine) {
      throw new MealPhotoAiError('offline', 'Richiede connessione a internet.');
    }

    let response: Response;
    try {
      response = await fetch('/api/analyze-meal-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
        signal: AbortSignal.timeout(25000)
      });
    } catch {
      throw new MealPhotoAiError('server', 'Connessione al servizio AI non riuscita.');
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new MealPhotoAiError('rate_limited', 'Limite giornaliero AI raggiunto, riprova più tardi.');
      }
      throw new MealPhotoAiError('server', 'Il servizio AI non è al momento disponibile.');
    }

    try {
      const data = await response.json();
      if (!Array.isArray(data?.items)) throw new Error('invalid shape');
      return data.items as RecognizedFoodItem[];
    } catch {
      throw new MealPhotoAiError('invalid_response', 'Risposta AI non valida.');
    }
  }
}
