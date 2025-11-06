/** Sheets read/write for UPC database (Nov 2025)
 *  - Always writes UPC as text literal ('012345678905)
 *  - Handles lookup of both plain and quoted formats
 */

function sh_() {
  return SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName(CFG.SHEET_NAME);
}

function getHeaders_() {
  const sh = sh_();
  const row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  row.forEach((h, i) => (map[String(h).trim()] = i + 1));
  return map;
}

/** Find 1-based row index by normalized UPC (or -1 if not found) */
function findRowByUPC_(upc) {
  const sh = sh_();
  const data = sh.getDataRange().getValues();
  const headers = getHeaders_();
  const col = headers['UPC'] || headers['upc'];
  if (!col) throw new Error('Header missing: UPC');

  const normTarget = normalizeUPC_(upc);
  const altTarget = "'" + normTarget; // quoted form stored in sheet
  for (let r = 2; r <= data.length; r++) {
    const raw = String(data[r - 1][col - 1] || '').trim();
    const norm = normalizeUPC_(raw.replace(/^'/, '')); // strip quote before normalizing
    if (norm === normTarget || raw === altTarget) return r;
  }
  return -1;
}

/** Insert or update a record safely, always writing UPC as a quoted string */
function upsertRecord(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('upsertRecord: invalid payload');

  const sh = sh_();
  const headers = getHeaders_();
  const now = new Date();
  const upc = normalizeUPC_(payload.upc || payload.UPC);
  const quotedUPC = upc ? `'${upc}` : ''; // store as literal string
  const r = findRowByUPC_(upc);

  const norm = {};
  Object.keys(payload).forEach(k => (norm[k.trim().toLowerCase()] = payload[k]));

  // Preserve existing data if updating
  let existingRow = [];
  if (r !== -1) existingRow = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];

  const orderedHeaders = Object.keys(headers).sort((a, b) => headers[a] - headers[b]);
  const rowVals = orderedHeaders.map((head, i) => {
    const key = head.trim().toLowerCase();
    switch (key) {
      case 'upc': return quotedUPC;
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
      case 'updated at': return now;
      default: return r === -1 ? '' : existingRow[i];
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