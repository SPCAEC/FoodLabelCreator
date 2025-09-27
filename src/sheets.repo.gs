/** Sheets read/write for UPC database */

function sh_(){ return SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName(CFG.SHEET_NAME); }

function getHeaders_(){
  const sh = sh_();  // cache it
  const row = sh.getRange(1,1,1, sh.getLastColumn()).getValues()[0];
  const map = {};
  row.forEach((h,i)=> map[String(h).trim()] = i+1);
  return map;
}

function findRowByUPC_(upc){
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

function readByUPC(upc){
  const sh = sh_(); const h = getHeaders_();
  const r = findRowByUPC_(upc);
  if (r === -1) return null;
  const row = sh.getRange(r,1,1,sh.getLastColumn()).getValues()[0];
  const val = k => row[h[k]-1] ?? '';
  return {
    upc: val(COL.UPC),
    species: val(COL.SPECIES),
    lifestage: val(COL.LIFESTAGE),
    brand: val(COL.BRAND),
    productName: val(COL.PRODUCT),
    flavor: val(COL.FLAVOR),
    type: val(COL.TYPE), // "Treat" or "Food"
    ingredients: val(COL.INGREDIENTS),
    pdfFileId: val(COL.PDF_FILE_ID),
    pdfUrl: val(COL.PDF_URL),
    frontPhotoId: val(COL.FRONT_PHOTO_ID),
    ingPhotoId: val(COL.ING_PHOTO_ID),
    createdAt: val(COL.CREATED_AT),
    _row: r,
  };
}

function upsertRecord(payload){
  if (!payload || typeof payload !== 'object') {
  throw new Error('upsertRecord: missing or invalid payload');
  }
  const sh = sh_(); const h = getHeaders_();
  const r = findRowByUPC_(payload.upc);
  const now = new Date();
  const rowVals = [];
  // Build row in header order
  const headersOrdered = Object.keys(h).sort((a,b)=> h[a]-h[b]);
  headersOrdered.forEach(head=>{
    let v = '';
    switch(head){
      case COL.UPC: v = payload.upc; break;
      case COL.SPECIES: v = payload.species; break;
      case COL.LIFESTAGE: v = payload.lifestage; break;
      case COL.BRAND: v = payload.brand; break;
      case COL.PRODUCT: v = payload.productName; break;
      case COL.FLAVOR: v = payload.flavor; break;
      case COL.TYPE: v = payload.type; break;
      case COL.INGREDIENTS: v = payload.ingredients; break;
      case COL.PDF_FILE_ID: v = payload.pdfFileId || ''; break;
      case COL.PDF_URL: v = payload.pdfUrl || ''; break;
      case COL.FRONT_PHOTO_ID: v = payload.frontPhotoId || ''; break;
      case COL.ING_PHOTO_ID: v = payload.ingPhotoId || ''; break;
      case COL.CREATED_AT: v = r === -1 ? now : (readByUPC(payload.upc)?.createdAt || now); break;
      case COL.UPDATED_AT: v = now; break;
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