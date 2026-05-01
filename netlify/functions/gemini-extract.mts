import { GoogleGenAI, Type } from "@google/genai";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "GEMINI_API_KEY no está configurada en Netlify. Ve a Site configuration > Environment variables." }, 500);
  }

  let base64Data: string;
  let mimeType: string;

  try {
    const body = await req.json();
    base64Data = body?.base64Data;
    mimeType = body?.mimeType;
  } catch (e) {
    return json({ error: "El cuerpo de la solicitud no es JSON válido o está vacío." }, 400);
  }

  if (!base64Data || !mimeType) {
    return json({ error: "Faltan parámetros requeridos: base64Data y mimeType." }, 400);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
                Analiza esta imagen de una factura o ticket de Paraguay.
                Extrae los siguientes datos con la mayor precisión posible:
                - Nombre del proveedor (Razon Social)
                - RUC del emisor (formato XXXXXXXX-X)
                - Timbrado (8 dígitos)
                - Número de factura (formato XXX-XXX-XXXXXXX)
                - Fecha de emisión (formato ISO YYYY-MM-DD)
                - Total a pagar (en Guaraníes, PYG)
                - IVA 10% y IVA 5% (si están discriminados)
                - Tipo de documento (Factura, Autofactura, Nota de Crédito, Ticket)

                Si algún campo no es visible o no existe, déjalo vacío o en 0.
                Para el RUC, asegúrate de incluir el dígito verificador.
                Para el número de factura, intenta reconstruir el formato completo 001-001-XXXXXXX si es posible.
              `,
            },
            {
              inlineData: { mimeType, data: base64Data },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            providerName: { type: Type.STRING },
            ruc: { type: Type.STRING },
            timbrado: { type: Type.STRING },
            receiptNumber: { type: Type.STRING },
            date: { type: Type.STRING },
            total: { type: Type.NUMBER },
            iva10: { type: Type.NUMBER },
            iva5: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            documentType: {
              type: Type.STRING,
              enum: ["INVOICE", "SELF_INVOICE", "CREDIT_NOTE", "TICKET", "OTHER"],
            },
          },
          required: ["providerName", "total", "date", "currency"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return json({ error: "Gemini no devolvió datos. Intenta con otra imagen." }, 500);
    }

    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJson);
    return json(data, 200);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("gemini-extract error:", message);
    return json({ error: `Error de Gemini: ${message}` }, 500);
  }
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/api/gemini-extract",
};
