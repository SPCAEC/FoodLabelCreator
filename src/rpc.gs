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
/** Normalize to 12-digit UPC-A */
function normalizeUPC12_(value) {
  let s = String(value || '').replace(/\D/g, '');
  if (s.length === 13 && s.startsWith('0')) s = s.slice(1); // EAN-13 -> UPC-A
  if (s.length > 13) return '';
  if (s.length < 12) s = s.padStart(12, '0');
  return s.length === 12 ? s : '';
}

/** Build/parse the sheet key that avoids numeric coercion */
function toSheetKey_(upc12) { return 'PFP' + upc12; }
function fromSheetKey_(key)  { return String(key || '').replace(/^PFP/, ''); }

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
    const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
    const upc12 = normalizeUPC12_(raw);
    const key = toSheetKey_(upc12);

    console.log(`[LOOKUP] Searching for key: ${key}`);

    // Try exact PFP match first
    let record = readByKey(key);

    // If not found, check for legacy unprefixed UPCs
    if (!record) {
      console.log('[LOOKUP] No PFP match, checking legacy rows...');
      const legacyRowNum = findRowByKeyOrLegacy_(upc12);
      if (legacyRowNum !== -1) {
        console.log(`[LOOKUP] ✅ Found legacy row ${legacyRowNum}, upgrading to key.`);
        const sh = sh_();
        const h = getHeaders_();
        const rowVals = sh.getRange(legacyRowNum, 1, 1, sh.getLastColumn()).getValues()[0];
        const rec = {};
        Object.keys(h).forEach(head => rec[head] = rowVals[h[head] - 1]);
        record = rec;
      }
    }

    // Nothing found
    if (!record) {
      console.log(`[LOOKUP] ❌ Not found for ${key}`);
      return { found: false, upc: upc12, key, reason: 'not_found' };
    }

    // Normalize structure for frontend
    const item = {
      upc: upc12,
      upcKey: key,
      species: record.Species || '',
      lifestage: record.Lifestage || '',
      brand: record.Brand || '',
      productName: record.ProductName || '',
      flavor: record['Recipe or Flavor'] || '',
      type: record['Treat or Food'] || '',
      ingredients: record.Ingredients || '',
      expiration: record.Expiration || '',
      pdfFileId: record['PDF File ID'] || '',
      pdfUrl: record['PDF URL'] || ''
    };

    console.log(`[LOOKUP] ✅ Found record for ${key}`, item);

    return { found: true, upc: upc12, key, item };
  });
}

/**
 * Create labels + save or upsert row.
 */
function upsertRecord(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('upsertRecord: missing or invalid payload');
  }

  // Normalize and validate key
  const upc12 = normalizeUPC12_(payload.UPC || payload.upc || '');
  const sheetKey = /^PFP\d{12}$/.test(payload.UPC)
    ? payload.UPC
    : toSheetKey_(upc12);

  if (!/^PFP\d{12}$/.test(sheetKey)) {
    throw new Error('upsertRecord: invalid key — must be PFP + 12 digits');
  }

  const sh = sh_();
  const h = getHeaders_();
  const now = new Date();
  const r = findRowByKey_(sheetKey);

  const headersOrdered = Object.keys(h).sort((a, b) => h[a] - h[b]);
  console.log('[UPSERT] key=%s row=%s', sheetKey, r === -1 ? 'new' : r);

  const rowVals = headersOrdered.map(head => {
    switch (head) {
      case 'UPC': return sheetKey;
      case 'Species': return payload.Species || payload.species || '';
      case 'Lifestage': return payload.Lifestage || payload.lifestage || 'Adult';
      case 'Brand': return payload.Brand || payload.brand || '';
      case 'ProductName': return payload.ProductName || payload.productName || '';
      case 'Recipe or Flavor': return payload['Recipe or Flavor'] || payload.flavor || '';
      case 'Treat or Food': return payload['Treat or Food'] || payload.type || 'Food';
      case 'Ingredients': return payload.Ingredients || payload.ingredients || '';
      case 'Expiration': return payload.Expiration || payload.expiration || '';
      case 'PDF File ID': return payload['PDF File ID'] || payload.pdfFileId || '';
      case 'PDF URL': return payload['PDF URL'] || payload.pdfUrl || '';
      case 'Front Photo ID': return payload['Front Photo ID'] || payload.frontPhotoId || '';
      case 'Ingredients Photo ID': return payload['Ingredients Photo ID'] || payload.ingPhotoId || '';
      case 'Created At':
      case 'CreatedAt':
        if (r === -1) return now;
        const prev = readByKey(sheetKey)?.createdAt;
        return prev || now;
      case 'Updated At':
      case 'UpdatedAt':
        return now;
      default:
        return '';
    }
  });

  if (r === -1) {
    sh.appendRow(rowVals);
    console.log('[UPSERT] appended new row');
    return sh.getLastRow();
  } else {
    sh.getRange(r, 1, 1, rowVals.length).setValues([rowVals]);
    console.log('[UPSERT] updated existing row', r);
    return r;
  }
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