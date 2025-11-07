function rpcTry(fn) {
  try {
    const result = fn();
    console.log('[rpcTry RETURN TEST]', JSON.stringify(result)); // 👈 add this
    return { ok: true, data: result ?? null };
  } catch (err) {
    console.error('[rpcTry ERROR]', err);
    return {
      ok: false,
      error: String(err && err.message ? err.message : err),
      stack: err && err.stack ? String(err.stack) : ''
    };
  }
}
function apiLookup(payload) {
  return rpcTry(() => {
    const raw =
      payload && typeof payload === 'object' && 'upc' in payload
        ? payload.upc
        : payload;

    const upc12 = normalizeUPC12_(raw);
    const key = toSheetKey_(upc12);

    // Try PFP-prefixed key first
    const record = readByKey(key);
    if (record) {
      // Remove any stored expiration before returning to the client
      if (record && 'expiration' in record) record.expiration = '';
      return { found: true, upc: upc12, key, item: record };
    }

    // Fallback: legacy 12-digit UPCs
    const legacyRow = findRowByKeyOrLegacy_(upc12);
    if (legacyRow !== -1) {
      const sh = sh_();
      const h = getHeaders_();
      const rowVals = sh.getRange(legacyRow, 1, 1, sh.getLastColumn()).getValues()[0];
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

    // Not found
    return { found: false, upc: upc12, key, reason: 'not_found' };
  });
}
function apiLookupWrapped(payload) {
  const result = apiLookup(payload);
  // Ensure plain JSON (not Apps Script object)
  return JSON.parse(JSON.stringify(result));
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