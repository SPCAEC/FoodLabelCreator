/** UI-callable APIs — return shapes the UI expects (no rpcTry wrapper) */

/* ---------- Helpers ---------- */

/** Normalize to a 12-digit UPC-A string (forgiving).
 *  - strips non-digits
 *  - if 13 digits starting with '0', drop the leading 0 (EAN-13 → UPC-A)
 *  - pads left if shorter (e.g., Sheets stored as number)
 *  - returns '' if impossible (>13 digits or empty)
 */
function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1);
  if (s.length > 13) return '';
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');
  return s.length === 12 ? s : '';
}

/** Map a sheet row object into the fields the UI expects, if needed. */
function normalizeRecordForUI_(rec) {
  // If your sheet columns already match (Species, Lifestage, Brand, ProductName, Recipe/Flavor, Ingredients, Treat/Food, UPC),
  // you can just return rec. Otherwise, transform here.
  return rec;
}

/* ---------- Lookup ---------- */

/** Lookup by UPC. Accepts a string or { upc } from the client. */
function apiLookup(payload) {
  try {
    const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
    const upc = normalizeUPC_(raw);
    if (!upc) return { found: false, reason: 'invalid_length', sent: String(raw || '') };

    const rec = readByUPC(upc); // <- your existing function that looks up the row
    if (!rec) return { found: false, upc };

    return { found: true, upc, item: normalizeRecordForUI_(rec) };
  } catch (e) {
    // Surface a safe error without throwing (frontend treats found=false as "new item")
    return { found: false, reason: 'exception', message: String(e && e.message || e) };
  }
}

/* ---------- Create label ---------- */

/** Preferred endpoint used by the new client code. */
function apiCreateLabels(payload) {
  try {
    if (!payload) return { error: true, message: 'Missing payload' };
    const upc = normalizeUPC_(payload.upc);
    if (!upc) return { error: true, message: 'Invalid UPC' };

    // Build the record to upsert from payload.sheetRecord if present, otherwise from payload fields
    const record = payload.sheetRecord || {
      UPC: upc,
      Species: payload.species || payload.Species || '',
      Lifestage: payload.lifestage || payload.Lifestage || 'Adult',
      Brand: payload.brand || payload.Brand || '',
      ProductName: payload.productName || payload.ProductName || '',
      'Recipe/Flavor': payload.flavor || payload.Flavor || '',
      'Treat/Food': payload.type || payload['Treat/Food'] || 'Food',
      Ingredients: payload.ingredients || payload.Ingredients || ''
    };

    // Generate labels PDF (your existing implementation)
    const pdf = generateLabelPDF_(payload); // should return { url, fileId } at least

    // Upsert to the sheet (your existing function). Consider including pdf info.
    const row = upsertRecord({ ...record, pdfFileId: pdf.fileId, pdfUrl: pdf.url });

    return { ok: true, pdfUrl: pdf.url, fileId: pdf.fileId, row };
  } catch (e) {
    return { error: true, message: String(e && e.message || e) };
  }
}

/** Backward compatibility for older client calls. */
function apiSaveAndCreateLabel(payload) {
  return apiCreateLabels(payload);
}

/* ---------- Image uploads (optional; normalize UPC) ---------- */

function apiUploadFront(upc, dataUrl) {
  try {
    const n = normalizeUPC_(upc);
    if (!n || !dataUrl) return { error: true, message: 'Missing image or UPC' };
    const f = saveImage_(n, dataUrl, 'front');
    return { ok: true, file: f };
  } catch (e) {
    return { error: true, message: String(e && e.message || e) };
  }
}

function apiUploadIngredients(upc, dataUrl) {
  try {
    const n = normalizeUPC_(upc);
    if (!n || !dataUrl) return { error: true, message: 'Missing image or UPC' };
    const f = saveImage_(n, dataUrl, 'ingredients');
    return { ok: true, file: f };
  } catch (e) {
    return { error: true, message: String(e && e.message || e) };
  }
}

/* ---------- AI extraction ---------- */
/** New client sends API.extract(front?, ingredients?) → apiExtractFromImages({ front, ingredients }) */
function apiExtractFromImages(req) {
  try {
    const out = aiExtract_(req); // your existing function
    return out;                  // expected to be { ok:true, item:{...}, needs:{...} } or similar
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
}