/** Sheets read/write for UPC database (revised Nov 2025 — resilient headers + safe updates) */

function sh_() {
  return SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName(CFG.SHEET_NAME);
}

function getHeaders_() {
  const sh = sh_();
  const row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  row.forEach((h, i) => (map[String(h).trim()] = i + 1));
  return map; // e.g. { "UPC":1, "Brand":2, ... }
}

/**
 * Find 1-based row index by normalized UPC (or -1 if not found)
 */
function findRowByUPC_(upc) {
  const sh = sh_();
  const data = sh.getDataRange().getValues();
  const headers = getHeaders_();
  const col = headers['UPC'] || headers['upc'];
  if (!col) throw new Error('Header missing: UPC');

  const normTarget = normalizeUPC_(upc);
  for (let r = 2; r <= data.length; r++) {
    const candidate = normalizeUPC_(data[r - 1][col - 1]);
    if (candidate === normTarget) return r;
  }
  return -1;
}

/**
 * Read one record by UPC
 */
function readByUPC(upc) {
  const sh = sh_();
  const h = getHeaders_();
  const r = findRowByUPC_(upc);
  if (r === -1) return null;

  const row = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
  const val = (k) => row[h[k] - 1] ?? '';

  return {
    upc: val('UPC'),
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
    frontPhotoId: val('Front Photo ID'),
    ingPhotoId: val('Ingredients Photo ID'),
    createdAt: val('Created At'),
    updatedAt: val('Updated At'),
    _row: r
  };
}

/**
 * Insert or update a record safely, preserving unrecognized columns.
 * Returns the row index written.
 */
function upsertRecord(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('upsertRecord: missing or invalid payload');
  }

  const sh = sh_();
  const headers = getHeaders_();
  const now = new Date();
  const upc = normalizeUPC_(payload.upc || payload.UPC);
  const r = findRowByUPC_(upc);

  // Normalize payload keys for easier matching
  const norm = {};
  Object.keys(payload).forEach((k) => (norm[k.trim().toLowerCase()] = payload[k]));

  // Preserve existing row if updating
  let existingRow = [];
  if (r !== -1) {
    existingRow = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
  }

  const orderedHeaders = Object.keys(headers).sort((a, b) => headers[a] - headers[b]);
  const rowVals = orderedHeaders.map((head, i) => {
    const key = head.trim().toLowerCase();
    switch (key) {
      case 'upc': return upc;
      case 'species': return norm.species || '';
      case 'lifestage': return norm.lifestage || '';
      case 'brand': return norm.brand || '';
      case 'productname': return norm.productname || '';
      case 'recipe or flavor': return norm.flavor || '';
      case 'treat or food': return norm.type || '';
      case 'ingredients': return norm.ingredients || '';
      case 'expiration': return norm.expiration || '';
      case 'pdf file id': return norm.pdffileid || '';
      case 'pdf url': return norm.pdfurl || '';
      case 'front photo id': return norm.frontphotoid || '';
      case 'ingredients photo id': return norm.ingphotoid || '';
      case 'created at':
        return r === -1
          ? now
          : (readByUPC(upc)?.createdAt || existingRow[i] || now);
      case 'updated at':
        return now;
      default:
        // Preserve unknown columns when updating
        return r === -1 ? '' : existingRow[i];
    }
  });

  if (r === -1) {
    sh.appendRow(rowVals);
    return sh.getLastRow();
  } else {
    sh.getRange(r, 1, 1, rowVals.length).setValues([rowVals]);
    return r;
  }
}