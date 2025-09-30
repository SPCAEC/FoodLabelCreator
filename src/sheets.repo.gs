/** Sheets read/write for UPC database (revised Sept 2025 with normalized payload and clean logging) */

function sh_() {
  return SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName(CFG.SHEET_NAME);
}

function getHeaders_() {
  const sh = sh_();
  const row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  row.forEach((h, i) => map[String(h).trim()] = i + 1);
  return map;
}

function findRowByUPC_(upc) {
  const sh = sh_();
  const data = sh.getDataRange().getValues();
  const h = getHeaders_();
  const col = h[COL.UPC];
  const normTarget = normalizeUPC_(upc);
  for (let r = 2; r <= data.length; r++) {
    const candidate = normalizeUPC_(data[r - 1][col - 1]);
    if (candidate === normTarget) return r;
  }
  return -1;
}

function readByUPC(upc) {
  const sh = sh_();
  const h = getHeaders_();
  const r = findRowByUPC_(upc);
  if (r === -1) return null;
  const row = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
  const val = k => row[h[k] - 1] ?? '';
  return {
    upc: val(COL.UPC),
    species: val(COL.SPECIES),
    lifestage: val(COL.LIFESTAGE),
    brand: val(COL.BRAND),
    productName: val(COL.PRODUCT),
    flavor: val(COL.FLAVOR),
    type: val(COL.TYPE),
    ingredients: val(COL.INGREDIENTS),
    expiration: val(COL.EXPIRATION),
    pdfFileId: val(COL.PDF_FILE_ID),
    pdfUrl: val(COL.PDF_URL),
    frontPhotoId: val(COL.FRONT_PHOTO_ID),
    ingPhotoId: val(COL.ING_PHOTO_ID),
    createdAt: val(COL.CREATED_AT),
    updatedAt: val(COL.UPDATED_AT),
    _row: r,
  };
}

function upsertRecord(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('upsertRecord: missing or invalid payload');
  }

  // Normalize keys to lowercase
  const normPayload = {};
  Object.keys(payload).forEach(k => normPayload[k.toLowerCase()] = payload[k]);

  const sh = sh_();
  const h = getHeaders_();
  const now = new Date();
  const upc = normPayload.upc;
  const r = findRowByUPC_(upc);

  const headersOrdered = Object.keys(h).sort((a, b) => h[a] - h[b]);
  console.log('[HEADERS ORDERED]', headersOrdered);
  console.log('[UPSERT PAYLOAD]', JSON.stringify(payload, null, 2));

  const rowVals = headersOrdered.map(head => {
    switch (head) {
      case 'UPC': return normPayload.upc;
      case 'Species': return normPayload.species;
      case 'Lifestage': return normPayload.lifestage;
      case 'Brand': return normPayload.brand;
      case 'ProductName': return normPayload.productname;
      case 'Recipe or Flavor': return normPayload.flavor;
      case 'Treat or Food': return normPayload.type;
      case 'Ingredients': return normPayload.ingredients;
      case 'Expiration': return normPayload.expiration;
      case 'PDF File ID': return normPayload.pdffileid || '';
      case 'PDF URL': return normPayload.pdfurl || '';
      case 'Created At':
        return r === -1 ? now : (readByUPC(normPayload.upc)?.createdAt || now);
      case 'Updated At':
        return now;
      case 'Front Photo ID': return normPayload.frontphotoid || '';
      case 'Ingredients Photo ID': return normPayload.ingphotoid || '';
      default: return '';
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