import { Injectable } from '@angular/core';

export interface BarcodeProduct {
  name: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

/**
 * Client per Open Food Facts (world.openfoodfacts.org) - nessuna chiave richiesta.
 * `null` = richiesta riuscita ma prodotto non presente nel database (status !== 1).
 * Un errore di rete/timeout viene invece lasciato propagare (throw), cosi il chiamante
 * puo distinguere "non trovato" da "offline".
 */
@Injectable({
  providedIn: 'root'
})
export class BarcodeLookupService {
  async lookupProduct(barcode: string): Promise<BarcodeProduct | null> {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,nutriments`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const data = await response.json();
    if (data?.status !== 1 || !data.product?.product_name) return null;

    const nutriments = data.product.nutriments ?? {};
    return {
      name: String(data.product.product_name).trim(),
      kcal_100g: extractKcal100g(nutriments),
      protein_100g: Math.max(0, Number(nutriments['proteins_100g']) || 0),
      carbs_100g: Math.max(0, Number(nutriments['carbohydrates_100g']) || 0),
      fat_100g: Math.max(0, Number(nutriments['fat_100g']) || 0)
    };
  }
}

/**
 * Alcune schede prodotto su Open Food Facts hanno `energy-kcal_100g` corrotto
 * (es. lo stesso numero del kJ inserito per errore in fase di compilazione).
 * Se il rapporto kJ/kcal si discosta troppo dal fattore di conversione reale
 * (~4.184), si preferisce ricavare i kcal dal kJ piuttosto che fidarsi del
 * campo kcal dichiarato.
 */
function extractKcal100g(nutriments: Record<string, unknown>): number {
  const kcal = Number(nutriments['energy-kcal_100g']) || 0;
  const kj = Number(nutriments['energy-kj_100g']) || 0;

  if (kj > 0) {
    const expectedKcal = kj / 4.184;
    const isImplausible = kcal <= 0 || Math.abs(kcal - expectedKcal) / expectedKcal > 0.2;
    if (isImplausible) return Math.max(0, Math.round(expectedKcal));
  }

  return Math.max(0, kcal);
}
