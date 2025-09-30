/** Sheets read/write for UPC database (revised Sept 2025) */

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

  const sh = sh_();
  const h = getHeaders_();

  // Normalize key casing (especially UPC)
  const upc = payload.upc || payload.UPC;
  const r = findRowByUPC_(upc);
  const now = new Date();

  const rowVals = [];

  // Build row in header order
  const headersOrdered = Object.keys(h).sort((a, b) => h[a] - h[b]);
  console.log('[HEADERS ORDERED]', headersOrdered);
  headersOrdered.forEach(head => {
  let v = '';
  switch(head){
    case 'UPC': v = payload.upc; break;
    case 'Species': v = payload.species; break;
    case 'Lifestage': v = payload.lifestage; break;
    case 'Brand': v = payload.brand; break;
    case 'ProductName': v = payload.productName; break;
    case 'Recipe/Flavor': v = payload.flavor; break;
    case 'Treat/Food': v = payload.type; break;
    case 'Ingredients': v = payload.ingredients; break;
    case 'Expiration': v = payload.expiration; break;
    case 'PDF File ID': v = payload.pdfFileId || ''; break;
    case 'PDF URL': v = payload.pdfUrl || ''; break;
    case 'Created At': v = r === -1 ? now : (readByUPC(payload.upc)?.createdAt || now); break;
    case 'Updated At': v = now; break;
    case 'Front Photo ID': v = payload.frontPhotoId || ''; break;
    case 'Ingredients Photo ID': v = payload.ingPhotoId || ''; break;
    default: v = '';
    }
    rowVals.push(v);
  });

  if (r === -1) {
    sh.appendRow(rowVals);
    return sh.getLastRow();
  } else {
    sh.getRange(r, 1, 1, rowVals.length).setValues([rowVals]);
    return r;
  }
}