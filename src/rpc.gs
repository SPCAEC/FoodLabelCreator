/** ---------------------------------------------------------------------------
 * Pantry Label Generator – UI-facing RPCs (OpenAI, PDF, Sheet integration)
 * Updated to ensure robust UPC normalization + correct lookup matching
 * ---------------------------------------------------------------------------
 */

/* ---------- RPC Error Wrapper ---------- */
function rpcTry(fn) {
  try {
    const result = fn();
    return { ok: true, data: result };
  } catch (err) {
    console.error({
      level: 'error',
      msg: 'rpc error',
      error: err.toString(),
      stack: err.stack
    });
    return { ok: false, error: err.toString() };
  }
}

/* ---------- Helpers ---------- */

/**
 * Normalize to 12-digit UPC-A safely from any value type.
 */
function normalizeUPC_(value) {
  let s = String(value == null ? '' : value).replace(/\D/g, '');
  if (s.length === 13 && s.startsWith('0')) s = s.slice(1);
  if (s.length > 13) return '';
  if (s.length < 12 && s.length > 0) s = s.padStart(12, '0');
  return s.length === 12 ? s : '';
}

/**
 * Get configured sheet.
 */
function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID') || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';
  const ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`Sheet not found: ${sheetName}`);
  return sh;
}

function findByUPCInSheet_(upc12) {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(h => String(h).trim());
  const idxUPC = headers.indexOf('UPC');
  if (idxUPC === -1) throw new Error('Header missing: UPC');

  const quoted = `'${upc12}`;
  for (let r = 1; r < values.length; r++) {
    const raw = String(values[r][idxUPC] || '').trim();
    const norm = normalizeUPC_(raw.replace(/^'/, '')); // remove quote for normalization
    if (norm === upc12 || raw === quoted) {
      const rec = {};
      headers.forEach((h, i) => (rec[h] = values[r][i]));
      console.log(`[MATCH FOUND] Row ${r + 1}: ${upc12}`);
      return rec;
    }
  }

  console.log(`[NO MATCH] ${upc12}`);
  return null;
}

/* ---------- Public APIs ---------- */

/**
 * Lookup product info by UPC.
 * Returns { ok:true, data:{ found:boolean, upc:string, item:Object|null } }
 */
function apiLookup(payload) {
  return rpcTry(() => {
    const raw = (payload && typeof payload === 'object' && 'upc' in payload)
      ? payload.upc
      : payload;

    const upc = normalizeUPC_(raw);
    console.log('[LOOKUP REQUEST]', { raw, normalized: upc });

    if (!upc) return { found: false, reason: 'invalid_length', sent: String(raw || '') };

    const row = findByUPCInSheet_(upc);
    if (!row) {
      console.log('[LOOKUP RESULT] Not found', upc);
      return { found: false, upc };
    }

    const item = {
      upc,
      species: String(row.Species || ''),
      lifestage: String(row.Lifestage || ''),
      brand: String(row.Brand || ''),
      productName: String(row.ProductName || ''),
      flavor: String(row['Recipe or Flavor'] || ''),
      type: String(row['Treat or Food'] || ''),
      ingredients: String(row.Ingredients || ''),
      expiration: row.Expiration || '',
      pdfFileId: row.pdfFileId || '',
      pdfUrl: row.pdfUrl || ''
    };

    console.log('[LOOKUP RESULT] Found match', item);
    return { found: true, upc, item };
  });
}

/**
 * Create labels + save or upsert row.
 */
function apiCreateLabels(payload) {
  return rpcTry(() => {
    if (!payload) throw new Error('Missing payload');
    const upc = normalizeUPC_(payload.upc);
    if (!upc) throw new Error('Invalid UPC');

    const pdf = generateLabelPDF_(payload);

    const record = {
      UPC: upc,
      Species: payload.species || payload.Species || '',
      Lifestage: payload.lifestage || payload.Lifestage || 'Adult',
      Brand: payload.brand || payload.Brand || '',
      ProductName: payload.productName || payload.ProductName || '',
      'Recipe or Flavor': payload.flavor || payload.Flavor || '',
      'Treat or Food': payload.type || payload['Treat or Food'] || 'Food',
      Ingredients: payload.ingredients || payload.Ingredients || '',
      Expiration: payload.expiration || '',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      pdfFileId: pdf.fileId,
      pdfUrl: pdf.url
    };

    console.log('[UPSERT RECORD]', JSON.stringify(record, null, 2));

    const row = upsertRecord(record);
    console.log('[UPSERT RESULT]', row);

    return {
      ok: true,
      pdfUrl: pdf.url,
      fileId: pdf.fileId,
      row
    };
  });
}

function apiSaveAndCreateLabel(payload) {
  return apiCreateLabels(payload);
}

function apiUploadFront(upc, dataUrl) {
  return rpcTry(() => {
    const norm = normalizeUPC_(upc);
    if (!norm || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(norm, dataUrl, 'front');
    return { file };
  });
}

function apiUploadIngredients(upc, dataUrl) {
  return rpcTry(() => {
    const norm = normalizeUPC_(upc);
    if (!norm || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(norm, dataUrl, 'ingredients');
    return { file };
  });
}

function apiExtractFromImages(payload) {
  return rpcTry(() => {
    const front = payload?.front;
    const ingredients = payload?.ingredients;
    if (!front || !ingredients) throw new Error('Missing image data');
    return aiExtract_({ front, ingredients });
  });
}