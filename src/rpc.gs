/** Pantry Label Generator – UI-facing RPCs (OpenAI, PDF, Sheet integration) */

/* ---------- Helpers ---------- */

// Normalize any input to a 12-digit UPC-A string
function normalizeUPC_(value) {
  let s = String(value || '').replace(/\D/g, '');
  if (s.length === 13 && s.startsWith('0')) s = s.slice(1); // Convert EAN-13 → UPC-A
  if (s.length > 13) return '';
  if (s.length < 12) s = s.padStart(12, '0'); // Recover leading zeros
  return s.length === 12 ? s : '';
}

// Open configured sheet from script properties
function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId   = props.getProperty('SHEET_ID')   || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';
  const ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`Sheet not found: ${sheetName}`);
  return sh;
}

// Scan sheet for a row where normalized UPC matches
function findByUPCInSheet_(upc12) {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(String);
  const idxUPC = headers.indexOf('UPC');
  if (idxUPC === -1) throw new Error('Header missing: UPC');

  for (let r = 1; r < values.length; r++) {
    const cell = values[r][idxUPC];
    const norm = normalizeUPC_(cell);
    console.log(`[ROW ${r}] Raw: ${cell}, Normalized: ${norm}`);

    if (norm === upc12) {
      const rec = {};
      headers.forEach((h, i) => rec[h] = values[r][i]);
      console.log('[MATCH FOUND]', rec);
      return rec;
    }
  }
  console.log('[NO MATCH]', upc12);
  return null;
}

/* ---------- Public APIs ---------- */

// Lookup a UPC and return the row if found
function apiLookup(payload) {
  return rpcTry(() => {
    const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
    const upc = normalizeUPC_(raw);

    console.log('[LOOKUP]', { raw, normalized: upc });

    if (!upc) return { found: false, reason: 'invalid_length', sent: String(raw || '') };

    const item = findByUPCInSheet_(upc);
    return item ? { found: true, upc, item } : { found: false, upc };
  });
}

// Generate label PDF and upsert record
// Generate label PDF and upsert record
function apiCreateLabels(payload) {
  return rpcTry(() => {
    if (!payload) throw new Error('Missing payload');

    // ✅ Normalize UPC once
    const upc = normalizeUPC_(payload.upc);
    if (!upc) throw new Error('Invalid UPC');

    // ✅ Generate the label file first (needs payload)
    const pdf = generateLabelPDF_(payload);

    // ✅ Build a normalized record object with exact headers
    const record = {
      UPC: upc,
      Species: payload.species || payload.Species || '',
      Lifestage: payload.lifestage || payload.Lifestage || 'Adult',
      Brand: payload.brand || payload.Brand || '',
      ProductName: payload.productName || payload.ProductName || '',
      'Recipe/Flavor': payload.flavor || payload.Flavor || '',
      'Treat/Food': payload.type || payload['Treat/Food'] || 'Food',
      Ingredients: payload.ingredients || payload.Ingredients || '',
      Expiration: payload.expiration || '',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      pdfFileId: pdf.fileId,
      pdfUrl: pdf.url
    };

    console.log('[SHEET RECORD]', record);

    // ✅ Upsert to sheet
    const row = upsertRecord(record);
    console.log('[UPSERTED ROW]', row);

    // ✅ Return data back to client
    return {
      ok: true,
      pdfUrl: pdf.url,
      fileId: pdf.fileId,
      row: row
    };
  });
}

// Backward compatibility alias
function apiSaveAndCreateLabel(payload) {
  return apiCreateLabels(payload);
}

// Save front image blob (base64 Data URL)
function apiUploadFront(upc, dataUrl) {
  return rpcTry(() => {
    const norm = normalizeUPC_(upc);
    if (!norm || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(norm, dataUrl, 'front');
    return { file };
  });
}

// Save ingredients image blob (base64 Data URL)
function apiUploadIngredients(upc, dataUrl) {
  return rpcTry(() => {
    const norm = normalizeUPC_(upc);
    if (!norm || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(norm, dataUrl, 'ingredients');
    return { file };
  });
}

// Run AI extraction on two photos (base64) and return structured data
function apiExtractFromImages(payload) {
  return rpcTry(() => {
    const front = payload?.front;
    const ingredients = payload?.ingredients;
    if (!front || !ingredients) throw new Error('Missing image data');
    return aiExtract_({ front, ingredients });
  });
}