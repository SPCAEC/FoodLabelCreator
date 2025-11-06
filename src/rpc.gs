/** ---------------------------------------------------------------------------
 * Pantry Label Generator – UI-facing RPCs (OpenAI, PDF, Sheet integration)
 * Unified version — Nov 2025
 * ✅ Ensures all RPCs return serialized objects (no nulls)
 * ✅ Merges lookup + wrapper into one exported function
 * ✅ Fully aligned with PFP-prefixed UPC key model
 * ---------------------------------------------------------------------------
 */

/* ---------- Safe wrapper ---------- */
function rpcTry(fn) {
  try {
    const result = fn();
    return { ok: true, data: result };
  } catch (err) {
    console.error({
      level: 'error',
      msg: 'rpc error',
      error: err.toString(),
      stack: err.stack,
    });
    return { ok: false, error: err.toString() };
  }
}

/* ---------- Core Lookup (wrapped + exported) ---------- */
function apiLookup(payload) {
  return rpcTry(() => {
    const raw =
      payload && typeof payload === 'object' && 'upc' in payload
        ? payload.upc
        : payload;

    const upc12 = normalizeUPC12_(raw);
    const key = toSheetKey_(upc12);
    console.log(`[LOOKUP] Searching for ${key} (raw=${raw})`);

    // Try PFP-prefixed key first
    const record = readByKey(key);
    if (record) {
      console.log(`[LOOKUP] ✅ Found record for ${key}`);
      return { found: true, upc: upc12, key, item: record };
    }

    // Fallback: legacy 12-digit UPCs
    const legacyRow = findRowByKeyOrLegacy_(upc12);
    if (legacyRow !== -1) {
      console.log(`[LOOKUP] Found legacy row ${legacyRow}.`);
      const sh = sh_();
      const h = getHeaders_();
      const rowVals = sh
        .getRange(legacyRow, 1, 1, sh.getLastColumn())
        .getValues()[0];
      const val = (k) => rowVals[h[k] - 1] ?? '';
      const recordLegacy = {
        upcKey: val('UPC'),
        upc: fromSheetKey_(val('UPC')),
        species: val('Species'),
        lifestage: val('Lifestage'),
        brand: val('Brand'),
        productName: val('ProductName'),
        flavor: val('Recipe or Flavor'),
        type: val('Treat or Food'),
        ingredients: val('Ingredients'),
        expiration: val('Expiration'),
        pdfFileId: val('PDF File ID'),
        pdfUrl: val('PDF URL'),
      };
      return { found: true, upc: upc12, key, item: recordLegacy };
    }

    console.log(`[LOOKUP] ❌ No record found for ${key}`);
    return { found: false, upc: upc12, key, reason: 'not_found' };
  });
}

/* ---------- Create / Save ---------- */
function apiCreateLabels(payload) {
  return rpcTry(() => {
    if (!payload) throw new Error('Missing payload');
    const upc12 = normalizeUPC12_(payload.upc);
    const key = toSheetKey_(upc12);
    const pdf = generateLabelPDF_(payload);

    const record = {
      UPC: key,
      Species: payload.species || '',
      Lifestage: payload.lifestage || 'Adult',
      Brand: payload.brand || '',
      ProductName: payload.productName || '',
      'Recipe or Flavor': payload.flavor || '',
      'Treat or Food': payload.type || 'Food',
      Ingredients: payload.ingredients || '',
      Expiration: payload.expiration || payload.Expiration || '',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      pdfFileId: pdf.fileId,
      pdfUrl: pdf.url,
    };

    const row = upsertRecord(record);
    console.log(`[CREATE LABEL] Saved record for ${key} on row ${row}`);
    return { ok: true, pdfUrl: pdf.url, fileId: pdf.fileId, row };
  });
}

function apiSaveAndCreateLabel(payload) {
  return apiCreateLabels(payload);
}

/* ---------- Uploads ---------- */
function apiUploadFront(upc, dataUrl) {
  return rpcTry(() => {
    const norm = normalizeUPC12_(upc);
    if (!norm || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(norm, dataUrl, 'front');
    return { file };
  });
}

function apiUploadIngredients(upc, dataUrl) {
  return rpcTry(() => {
    const norm = normalizeUPC12_(upc);
    if (!norm || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(norm, dataUrl, 'ingredients');
    return { file };
  });
}

/* ---------- Extraction ---------- */
function apiExtractFromImages(payload) {
  return rpcTry(() => {
    const front = payload?.front;
    const ingredients = payload?.ingredients;
    if (!front || !ingredients) throw new Error('Missing image data');
    return aiExtract_({ front, ingredients });
  });
}