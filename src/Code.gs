// --- Forgiving UPC normalizer ---
function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') {
    s = s.slice(1); // EAN-13 with leading 0 → UPC-A
  }
  if (s.length > 13) return ''; // invalid, way too long
  if (s.length < 12 && s.length > 0) {
    s = s.padStart(12, '0'); // pad numbers like 11939025916 → 011939025916
  }
  return s.length === 12 ? s : '';
}

// --- Main lookup with diagnostics ---
function apiLookup(payload) {
  const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
  const upc = normalizeUPC_(raw);

  const props = PropertiesService.getScriptProperties();
  const sheetId   = props.getProperty('SHEET_ID')   || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';

  if (!upc) {
    return { found: false, reason: 'invalid_length', sent: String(raw || ''), __ver: 'v4' };
  }

  let ss, sh;
  try {
    ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  } catch (e) {
    return { found: false, reason: 'sheet_open_failed', detail: String(e), __ver: 'v4' };
  }
  sh = ss.getSheetByName(sheetName);
  if (!sh) {
    return { found: false, reason: 'sheet_not_found', sheetName, __ver: 'v4' };
  }

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return { found: false, reason: 'empty_sheet', rows: values.length, __ver: 'v4' };
  }

  const headers = values[0].map(String);
  const idxUPC = headers.indexOf('UPC');
  if (idxUPC === -1) {
    return { found: false, reason: 'upc_header_missing', headers, expect: 'UPC', __ver: 'v4' };
  }

  const samples = [];
  let hit = null;
  for (let r = 1; r < values.length; r++) {
    const cellNorm = normalizeUPC_(values[r][idxUPC]);
    if (samples.length < 6 && cellNorm) samples.push(cellNorm);
    if (cellNorm === upc) {
      const rec = {};
      headers.forEach((h, i) => rec[h] = values[r][i]);
      hit = rec;
      break;
    }
  }

  if (!hit) {
    return {
      found: false,
      upc,
      reason: 'not_found',
      samples,
      sheet: { id: sheetId || '(active)', name: sheetName, header: 'UPC' },
      __ver: 'v4'
    };
  }

  return { found: true, upc, item: hit, __ver: 'v4' };
}