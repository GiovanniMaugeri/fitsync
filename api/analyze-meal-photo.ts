import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface RecognizedFoodItem {
  name: string;
  estimated_grams: number;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

type ErrorCode = 'BAD_REQUEST' | 'MISSING_KEY' | 'RATE_LIMITED' | 'AI_ERROR' | 'INVALID_RESPONSE';

const MAX_BASE64_LENGTH = 2_000_000; // ~1.5MB immagine, ben sotto il body limit delle Vercel Functions

const PROMPT = `Sei un nutrizionista esperto di cucina italiana. Analizza la foto di questo piatto e identifica ogni alimento distinto visibile (scomponi il piatto nei singoli componenti: es. "pasta al pomodoro", "petto di pollo alla griglia", "insalata mista" come voci separate, non un'unica voce generica).

Per ciascun alimento identificato, stima:
- la grammatura della porzione visibile, usando come riferimento di scala il piatto (diametro standard ~26-28cm) e le posate se visibili
- i valori nutrizionali medi per 100g di quell'alimento (non della porzione)

Se un alimento è un composto (es. "pasta al pomodoro"), stima i valori per 100g del piatto composito così come appare, non dei singoli ingredienti separati.

Se la foto non è chiara, è buia, o non contiene cibo riconoscibile, restituisci un array vuoto — non inventare alimenti.

Rispondi esclusivamente con l'array JSON richiesto dallo schema, nessun testo aggiuntivo.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      estimated_grams: { type: 'NUMBER' },
      kcal_100g: { type: 'NUMBER' },
      protein_100g: { type: 'NUMBER' },
      carbs_100g: { type: 'NUMBER' },
      fat_100g: { type: 'NUMBER' }
    },
    required: ['name', 'estimated_grams', 'kcal_100g', 'protein_100g', 'carbs_100g', 'fat_100g']
  }
};

function sendError(res: VercelResponse, status: number, code: ErrorCode, error: string) {
  res.status(status).json({ code, error });
}

function sanitizeItems(raw: unknown): RecognizedFoodItem[] {
  if (!Array.isArray(raw)) throw new Error('not an array');

  const clampNum = (v: unknown) => Math.max(0, Number(v) || 0);

  return raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
    .map(it => ({
      name: String(it['name'] ?? '').trim().slice(0, 100),
      estimated_grams: clampNum(it['estimated_grams']),
      kcal_100g: clampNum(it['kcal_100g']),
      protein_100g: clampNum(it['protein_100g']),
      carbs_100g: clampNum(it['carbs_100g']),
      fat_100g: clampNum(it['fat_100g'])
    }))
    .filter(it => it.name.length > 0 && it.estimated_grams > 0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'BAD_REQUEST', 'Metodo non supportato.');
  }

  const { imageBase64, mimeType } = req.body ?? {};
  if (typeof imageBase64 !== 'string' || !imageBase64 || typeof mimeType !== 'string' || !mimeType) {
    return sendError(res, 400, 'BAD_REQUEST', 'imageBase64 e mimeType sono obbligatori.');
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return sendError(res, 400, 'BAD_REQUEST', 'Immagine troppo grande.');
  }

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    return sendError(res, 500, 'MISSING_KEY', 'GEMINI_API_KEY non configurata sul server.');
  }

  const model = process.env['GEMINI_MODEL'] || 'gemini-flash-lite-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: PROMPT }, { inlineData: { mimeType, data: imageBase64 } }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      }),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    return sendError(res, 502, 'AI_ERROR', 'Impossibile contattare il servizio AI.');
  }

  if (!geminiResponse.ok) {
    if (geminiResponse.status === 429) {
      return sendError(res, 429, 'RATE_LIMITED', 'Limite di richieste AI raggiunto, riprova più tardi.');
    }
    return sendError(res, 502, 'AI_ERROR', 'Il servizio AI ha risposto con un errore.');
  }

  try {
    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') throw new Error('missing text');

    const items = sanitizeItems(JSON.parse(text));
    return res.status(200).json({ items });
  } catch {
    return sendError(res, 502, 'INVALID_RESPONSE', 'Risposta AI non valida.');
  }
}
