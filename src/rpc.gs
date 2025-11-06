/** ---------------------------------------------------------------------------
 * Pantry Label Generator – UI-facing RPCs (OpenAI, PDF, Sheet integration)
 * Synced with November 2025 sheets.repo.gs (PFP-prefixed UPC model)
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

/* ---------- Local helpers (for normalization only) ---------- */

/** Normalize any input to 12-digit UPC-A */
function normalizeUPC12_(value) {
  let s = String(value || '').replace(/\D/g, '');
  if (s.length === 13 && s.startsWith('0')) s = s.slice(1);
  if (s.length > 13) return '';
  if (s.length < 12) s = s.padStart(12, '0');
  return s.length === 12 ? s : '';
}

/** Sheet key helpers (match sheets.repo.gs) */
function toSheetKey_(upc12) { return 'PFP' + upc12; }
function fromSheetKey_(key) { return String(key || '').replace(/^PFP/, ''); }

/* ---------- Public APIs ---------- */

/**
 * Lookup product info by UPC.
 * Returns { ok:true, data:{ found:boolean, upc:string, key:string, item:Object|null } }
 */
function apiLookup(payload) {
  return rpcTry(() => {
    const raw = (payload && typeof payload === 'object' && 'upc' in payload)
      ? payload.upc
      : payload;

    const upc12 = normalizeUPC12_(raw);
    const key = toSheetKey_(upc12);

    console.log(`[LOOKUP] Searching for ${key} (raw=${raw})`);

    // First try PFP-prefixed row
    let record = readByKey(key);

    // If not found, try legacy plain UPC
    if (!record) {
      const legacyRow = findRowByKeyOrLegacy_(upc12);
      if (legacyRow !== -1) {
        console.log(`[LOOKUP] Found legacy row ${legacyRow}`);
        const sh = sh_();
        const h = getHeaders_();
        const rowVals = sh.getRange(legacyRow, 1, 1, sh.getLastColumn()).getValues()[0];
        const val = k => rowVals[h[k] - 1] ?? '';
        record = {
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
          pdfUrl: val('PDF URL')
        };
      }
    }

    if (!record) {
      console.log(`[LOOKUP] ❌ No record found for ${key}`);
      return { found: false, upc: upc12, key, reason: 'not_found' };
    }

    console.log(`[LOOKUP] ✅ Found record for ${key}`);
    return { found: true, upc: upc12, key, item: record };
  });
}

/**
 * Create label(s) and upsert the record with PFP-prefixed key.
 * Returns PDF URL and file ID.
 */
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
      Expiration: payload.expiration || '',
      'PDF File ID': pdf.fileId,
      'PDF URL': pdf.url,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };

    console.log(`[UPSERT] Writing record ${key}`);
    const row = upsertRecord(record);

    return {
      ok: true,
      upc: upc12,
      key,
      pdfUrl: pdf.url,
      fileId: pdf.fileId,
      row
    };
  });
}

/** Alias kept for legacy frontends */
function apiSaveAndCreateLabel(payload) {
  return apiCreateLabels(payload);
}

/**
 * Upload product front image
 */
function apiUploadFront(upc, dataUrl) {
  return rpcTry(() => {
    const upc12 = normalizeUPC12_(upc);
    const key = toSheetKey_(upc12);
    if (!key || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(key, dataUrl, 'front');
    return { file };
  });
}

/**
 * Upload ingredients image
 */
function apiUploadIngredients(upc, dataUrl) {
  return rpcTry(() => {
    const upc12 = normalizeUPC12_(upc);
    const key = toSheetKey_(upc12);
    if (!key || !dataUrl) throw new Error('Missing image or UPC');
    const file = saveImage_(key, dataUrl, 'ingredients');
    return { file };
  });
}

/**
 * Extract label text using OpenAI from front/ingredients images.
 */
function apiExtractFromImages(payload) {
  return rpcTry(() => {
    const front = payload?.front;
    const ingredients = payload?.ingredients;
    if (!front || !ingredients) throw new Error('Missing image data');
    return aiExtract_({ front, ingredients });
  });
}