/** ================================
 *  Food Label Creator — Apps Script
 *  - HTML bootstrap + server includes
 *  - Lookup API with UPC normalization
 *  ================================ */

/** App bootstrap */
function doGet(e) {
  const tpl = HtmlService.createTemplateFromFile('Index.html'); // root HTML template
  tpl.cacheBust = Date.now();
  return tpl
    .evaluate()
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Server-side include helper */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ================================
 *  Lookup API
 *  ================================ */

function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1);       // EAN-13 → UPC-A
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');       // pad lost leading zeros
  return s.length === 12 ? s : '';
}

function apiLookup(payload) {
  const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
  const upc = normalizeUPC_(raw);
  if (!upc) {
    return { found: false, reason: 'invalid_length', sent: String(raw || '') };
  }

  const hit = findByUPC_(upc);
  return hit ? { found: true, upc, item: hit } : { found: false, upc };
}

function findByUPC_(upc12) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');   // must be set in script properties
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';
  const upcHeader = props.getProperty('UPC_HEADER') || 'UPC';

  const ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(String);
  const idxUPC = headers.indexOf(upcHeader);
  if (idxUPC === -1) throw new Error('UPC column not found (header: ' + upcHeader + ')');

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const upcCell = normalizeUPC_(row[idxUPC]);
    if (upcCell === upc12) {
      const rec = {};
      for (let c = 0; c < headers.length; c++) rec[headers[c]] = row[c];
      return rec;
    }
  }
  return null;
}