import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

// Lazy-initialize the SQL connection to avoid top-level errors
let _sql: NeonQueryFunction<false, false> | null = null;

function getSql() {
  if (!_sql) {
    const dbUrl = process.env.NETLIFY_DATABASE_URL;
    if (!dbUrl) {
      throw new Error("NETLIFY_DATABASE_URL environment variable is not set");
    }
    _sql = neon(dbUrl);
  }
  return _sql;
}

// Default user ID - in a real app this would come from auth
const DEFAULT_USER_EMAIL = "demo@taxflow.py";
const DEFAULT_USER_NAME = "Usuario Demo";

async function getOrCreateDefaultUser() {
  const sql = getSql();
  const rows = await sql`SELECT id FROM users WHERE email = ${DEFAULT_USER_EMAIL} LIMIT 1`;
  if (rows.length > 0) {
    return rows[0].id as string;
  }
  const inserted = await sql`
    INSERT INTO users (id, email, nombre, created_at, updated_at)
    VALUES (gen_random_uuid(), ${DEFAULT_USER_EMAIL}, ${DEFAULT_USER_NAME}, NOW(), NOW())
    RETURNING id
  `;
  return inserted[0].id as string;
}

// Valid lowercase DB categories matching the CHECK constraint
const VALID_CATEGORIES = [
  "alimentacion", "transporte", "salud", "educacion",
  "vestimenta", "vivienda", "entretenimiento", "servicios", "otros",
] as const;

// Map of common English/Spanish category names to valid DB values
const CATEGORY_MAP: Record<string, string> = {
  // Spanish with accents
  "alimentación": "alimentacion",
  "educación": "educacion",
  // English
  "food": "alimentacion",
  "transport": "transporte",
  "transportation": "transporte",
  "health": "salud",
  "education": "educacion",
  "clothing": "vestimenta",
  "housing": "vivienda",
  "entertainment": "entretenimiento",
  "services": "servicios",
  "other": "otros",
  "others": "otros",
};

function normalizeCategory(value: string | undefined | null): string {
  if (!value) return "otros";
  const lower = value.toLowerCase().trim();
  // Already a valid DB value
  if ((VALID_CATEGORIES as readonly string[]).includes(lower)) return lower;
  // Strip accents and check again
  const stripped = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if ((VALID_CATEGORIES as readonly string[]).includes(stripped)) return stripped;
  // Check the mapping
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  if (CATEGORY_MAP[stripped]) return CATEGORY_MAP[stripped];
  return "otros";
}

// Map DB row to frontend Receipt shape
function mapRowToReceipt(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.fecha ? new Date(row.fecha as string).toISOString() : new Date().toISOString(),
    providerName: row.proveedor || "",
    ruc: row.ruc || "",
    timbrado: row.timbrado || "",
    receiptNumber: row.nro_factura || "",
    total: Number(row.monto_total) || 0,
    iva10: Number(row.iva_10) || 0,
    iva5: Number(row.iva_5) || 0,
    currency: "PYG",
    type: row.tipo === "ingreso" ? "INCOME" : "EXPENSE",
    category: row.categoria || "otros",
    irpInciso: "",
    origin: "MANUAL",
    status: "VERIFIED",
    confidence: 1,
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    imageUrl: row.imagen_url || undefined,
    isDeductible: (row.gasto_deducible_irp as boolean) ?? true,
  };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/api\/comprobantes\/?/, "").split("/").filter(Boolean);
  const comprobanteId = pathParts[0] || null;

  try {
    const sql = getSql();
    const userId = await getOrCreateDefaultUser();

    // GET /api/comprobantes
    if (req.method === "GET" && !comprobanteId) {
      const rows = await sql`
        SELECT * FROM comprobantes
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      const receipts = rows.map(mapRowToReceipt);
      return new Response(JSON.stringify(receipts), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /api/comprobantes
    if (req.method === "POST") {
      const body = await req.json();
      console.log("POST /api/comprobantes - request body:", JSON.stringify(body));

      const tipo = body.type === "INCOME" ? "ingreso" : "egreso";
      const fecha = body.date ? new Date(body.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
      const montoTotal = Math.round(body.total || 0);
      const proveedor = body.providerName || "";
      const ruc = body.ruc || "";
      const categoria = normalizeCategory(body.category);
      const nroFactura = body.receiptNumber || "";
      const timbrado = body.timbrado || "";
      const iva10 = Math.round(body.iva10 || 0);
      const iva5 = Math.round(body.iva5 || 0);
      const gastoDeducibleIrp = body.isDeductible ?? true;
      const imagenUrl = body.imageUrl || null;

      console.log("POST /api/comprobantes - inserting with values:", JSON.stringify({
        userId, tipo, montoTotal, proveedor, ruc, fecha,
        categoria, nroFactura, timbrado, iva10, iva5,
        gastoDeducibleIrp, imagenUrl,
      }));

      const rows = await sql`
        INSERT INTO comprobantes (
          id, user_id, tipo, monto_total, proveedor, ruc, fecha,
          categoria, nro_factura, timbrado, iva_10, iva_5,
          gasto_deducible_irp, imagen_url, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${userId}, ${tipo}, ${montoTotal},
          ${proveedor}, ${ruc}, ${fecha},
          ${categoria}, ${nroFactura}, ${timbrado},
          ${iva10}, ${iva5},
          ${gastoDeducibleIrp}, ${imagenUrl},
          NOW(), NOW()
        )
        RETURNING *
      `;

      console.log("POST /api/comprobantes - insert successful, returned:", JSON.stringify(rows[0]));

      return new Response(JSON.stringify(mapRowToReceipt(rows[0])), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    // PUT /api/comprobantes/:id
    if (req.method === "PUT" && comprobanteId) {
      const body = await req.json();
      const tipo = body.type === "INCOME" ? "ingreso" : "egreso";
      const fecha = body.date ? new Date(body.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      const rows = await sql`
        UPDATE comprobantes SET
          tipo = ${tipo},
          monto_total = ${Math.round(body.total || 0)},
          proveedor = ${body.providerName || ""},
          ruc = ${body.ruc || ""},
          fecha = ${fecha},
          categoria = ${normalizeCategory(body.category)},
          nro_factura = ${body.receiptNumber || ""},
          timbrado = ${body.timbrado || ""},
          iva_10 = ${Math.round(body.iva10 || 0)},
          iva_5 = ${Math.round(body.iva5 || 0)},
          gasto_deducible_irp = ${body.isDeductible ?? true},
          imagen_url = ${body.imageUrl || null},
          updated_at = NOW()
        WHERE id = ${comprobanteId} AND user_id = ${userId}
        RETURNING *
      `;
      if (rows.length === 0) {
        return new Response(JSON.stringify({ error: "Comprobante no encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(mapRowToReceipt(rows[0])), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // DELETE /api/comprobantes/:id
    if (req.method === "DELETE" && comprobanteId) {
      const rows = await sql`
        DELETE FROM comprobantes
        WHERE id = ${comprobanteId} AND user_id = ${userId}
        RETURNING id
      `;
      if (rows.length === 0) {
        return new Response(JSON.stringify({ error: "Comprobante no encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("Comprobantes function error:", errMessage);
    console.error("Error stack:", errStack);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error as object)));
    return new Response(JSON.stringify({
      error: "Error interno del servidor",
      details: errMessage,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: ["/api/comprobantes", "/api/comprobantes/*"],
};
