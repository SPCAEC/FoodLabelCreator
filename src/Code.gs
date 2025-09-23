/** Food Label Creator — Web App bootstrap + APIs (CDN Scandit load) */

/* -------------------- HTML bootstrap -------------------- */
function doGet() {
  const tpl = HtmlService.createTemplateFromFile('ui/Index');
  tpl.cacheBust = Date.now();
  return tpl
    .evaluate()
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Server-side include for HtmlService templates. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* -------------------- UPC utils + Lookup API -------------------- */

/** Normalize to 12-digit UPC-A (forgiving). */
function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1); // EAN-13 -> UPC-A
  if (s.length > 13) return '';
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');  // recover leading zeros
  return s.length === 12 ? s : '';
}

/** Lookup by UPC against configured sheet; returns UI-ready shape with diagnostics. */
function apiLookup(payload) {
  const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
  const upc = normalizeUPC_(raw);

  const props     = PropertiesService.getScriptProperties();
  const sheetId   = props.getProperty('SHEET_ID')   || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';

  if (!upc) return { found:false, reason:'invalid_length', sent:String(raw||''), __ver:'cdn-v1' };

  let ss;
  try { ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive(); }
  catch (e) { return { found:false, reason:'sheet_open_failed', detail:String(e), __ver:'cdn-v1' }; }

  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { found:false, reason:'sheet_not_found', sheetName, __ver:'cdn-v1' };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { found:false, reason:'empty_sheet', rows:values.length, __ver:'cdn-v1' };

  const headers = values[0].map(String);
  const idxUPC  = headers.indexOf('UPC');
  if (idxUPC === -1) return { found:false, reason:'upc_header_missing', headers, expect:'UPC', __ver:'cdn-v1' };

  const samples = [];
  let hit = null;
  for (let r = 1; r < values.length; r++) {
    const norm = normalizeUPC_(values[r][idxUPC]);
    if (samples.length < 6 && norm) samples.push(norm);
    if (norm === upc) {
      const rec = {};
      headers.forEach((h,i)=> rec[h] = values[r][i]);
      hit = rec; break;
    }
  }
  if (!hit) {
    return {
      found:false, upc, reason:'not_found', samples,
      sheet:{ id: sheetId || '(active)', name: sheetName, header: 'UPC' }, __ver:'cdn-v1'
    };
  }
  return { found:true, upc, item:hit, __ver:'cdn-v1' };
}