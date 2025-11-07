function sh_() {
  return SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName(CFG.SHEET_NAME);
}

/** Build header map (header → column number) */
function getHeaders_() {
  const sh = sh_();
  const row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  row.forEach((h, i) => map[String(h).trim()] = i + 1);
  return map;
}

/** Normalize UPC → 12-digit string */
function normalizeUPC12_(value) {
  let s = String(value || '').replace(/\D/g, '');
  if (s.length === 13 && s.startsWith('0')) s = s.slice(1); // EAN→UPC
  if (s.length > 13) return '';
  if (s.length < 12) s = s.padStart(12, '0');
  return s.length === 12 ? s : '';
}

/** Convert to stored sheet key (PFP+12 digits) */
function toSheetKey_(upc12) {
  return 'PFP' + upc12;
}

/** Remove PFP prefix for UI or internal display */
function fromSheetKey_(key) {
  return String(key || '').replace(/^PFP/, '');
}

/** Find row by sheet key (exact string match in UPC column) */
function findRowByKey_(sheetKey) {
  const sh = sh_();
  const data = sh.getDataRange().getValues();
  const h = getHeaders_();
  const col = h['UPC'];
  if (!col) throw new Error('Header "UPC" not found.');
  const target = String(sheetKey || '').trim();

  console.log(`[FIND] Searching for ${target} in ${data.length - 1} rows…`);

  const candidates = [];
  for (let r = 2; r <= data.length; r++) {
    const val = String(data[r - 1][col - 1] || '').trim();
    candidates.push(val);
    if (val === target) {
      console.log(`[FIND] ✅ MATCH FOUND on row ${r}: ${val}`);
      return r;
    }
  }

  console.log(`[FIND] ❌ No match for ${target}. Sample of first 5:`, candidates.slice(0, 5));
  return -1;
}

/** Read a row by sheet key → normalized record object */
function readByKey(sheetKey) {
  const sh = sh_();
  const h = getHeaders_();
  const r = findRowByKey_(sheetKey);
  if (r === -1) return null;

  const row = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
  const val = k => row[h[k] - 1] ?? '';

  return {
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
    frontPhotoId: val('Front Photo ID'),
    ingPhotoId: val('Ingredients Photo ID'),
    createdAt: val('Created At'),
    updatedAt: val('Updated At'),
    _row: r,
  };
}

/** Upsert (insert or update) record by PFP key */
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
        if (r === -1) return now;
        const prev = readByKey(sheetKey)?.createdAt;
        return prev || now;
      case 'Updated At': return now;
      default: return '';
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

/** Find by either PFP key or legacy plain 12-digit UPC (for backward compatibility) */
function findRowByKeyOrLegacy_(upcRaw) {
  const upc12 = normalizeUPC12_(upcRaw);
  const key = toSheetKey_(upc12);
  let row = findRowByKey_(key);
  if (row !== -1) return row;

  // Fallback for older rows that still have plain UPCs
  const sh = sh_();
  const h = getHeaders_();
  const col = h['UPC'];
  if (!col) throw new Error('Header "UPC" not found.');
  for (let r = 2; r <= sh.getLastRow(); r++) {
    const val = String(sh.getRange(r, col).getValue() || '').trim();
    const legacy = normalizeUPC12_(val);
    if (legacy === upc12) return r;
  }
  return -1;
}
function testFind() {
  const testUPC = '017800100335'; // any real one you have
  const key = toSheetKey_(testUPC);
  const row = findRowByKey_(key);
  Logger.log('Test key: ' + key);
  Logger.log('Found row: ' + row);
}