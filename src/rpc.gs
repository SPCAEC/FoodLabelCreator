/** UI-callable APIs — return shapes the UI expects (no rpcTry wrapper) */

/* ---------- Helpers ---------- */

// Normalize to a forgiving 12-digit UPC-A
function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1); // EAN-13 → UPC-A
  if (s.length > 13) return '';
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');  // recover lost leading zeros
  return s.length === 12 ? s : '';
}

// Open the configured sheet (from Script Properties)
function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId   = props.getProperty('SHEET_ID')   || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';
  const ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);
  return sh;
}

/** Scan the sheet for a row whose normalized UPC matches upc12; returns a record keyed by headers. */
function findByUPCInSheet_(upc12) {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(String);
  const idxUPC = headers.indexOf('UPC');
  if (idxUPC === -1) throw new Error('UPC column not found (header: UPC)');

  for (let r = 1; r < values.length; r++) {
    const cellNorm = normalizeUPC_(values[r][idxUPC]);
    if (cellNorm === upc12) {
      const rec = {};
      headers.forEach((h, i) => rec[h] = values[r][i]);
      return rec;
    }
  }
  return null;
}

/* ---------- Lookup ---------- */

/** Lookup by UPC. Accepts a string or { upc } from the client. */
function apiLookup(payload) {
  try {
    const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
    const upc = normalizeUPC_(raw);
    if (!upc) return { found: false, reason: 'invalid_length', sent: String(raw || '') };

    const rec = findByUPCInSheet_(upc);
    if (!rec) return { found: false, upc };

    return { found: true, upc, item: rec };
  } catch (e) {
    // Don’t throw; return a safe error for the client
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