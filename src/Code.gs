/** Food Label Creator — Web App bootstrap + static proxy + APIs */

/** ------------------------------------------------------------------
 *  SAME-ORIGIN STATIC PROXY (for Scandit bundled JS only)
 *  - We proxy ONLY the JS bundle to avoid ORB/CSP blocking of <script> tags.
 *  - The engineLocation (WASM files) continues to load from the CDN.
 *    Apps Script cannot serve .wasm with correct binary MIME reliably,
 *    so we don't proxy those.
 *  ------------------------------------------------------------------ */
const SCANDIT_BUNDLED_JS =
  'https://cdn.jsdelivr.net/npm/scandit-web-datacapture-bundled@7.6.1/build/js/index.min.js';

/** Fetch the bundled JS and return it same-origin as application/javascript. */
function serveScanditBundled_() {
  const res = UrlFetchApp.fetch(SCANDIT_BUNDLED_JS, {
    muteHttpExceptions: true,
    followRedirects: true,
  });
  const code = res.getResponseCode();
  console.log(JSON.stringify({
    level: 'info', msg: 'static fetch', from: SCANDIT_BUNDLED_JS, status: code
  }));

  if (code !== 200) {
    return ContentService
      .createTextOutput('/* failed to fetch Scandit bundle: ' + code + ' */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  // Return JS text with proper MIME so the browser executes it.
  return ContentService
    .createTextOutput(res.getContentText('UTF-8'))
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** ------------------------------------------------------------------
 *  doGet router
 *  - ?static=scandit-index  -> serves bundled JS from same origin
 *  - otherwise: render the app HTML
 *  ------------------------------------------------------------------ */
function doGet(e) {
  const p = e && e.parameter && e.parameter.static;
  if (p) {
    if (p === 'scandit-index') return serveScanditBundled_();
    // Unknown static path -> noop response
    return ContentService
      .createTextOutput('/* unknown static route */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Normal HTML render
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

/** ------------------------------------------------------------------
 *  UPC utilities + Lookup API (diagnostic-friendly, forgiving)
 *  ------------------------------------------------------------------ */

/** Normalize to 12-digit UPC-A (forgiving):
 *  - strip non-digits
 *  - EAN-13 with leading 0 -> drop leading 0
 *  - pad lost leading zeros (e.g., numeric cells) up to 12
 *  - return '' if invalid
 */
function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1); // EAN-13 -> UPC-A
  if (s.length > 13) return '';
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');
  return s.length === 12 ? s : '';
}

/** Lookup by UPC against configured sheet; returns UI-ready shape with diagnostics. */
function apiLookup(payload) {
  const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
  const upc = normalizeUPC_(raw);

  const props = PropertiesService.getScriptProperties();
  const sheetId   = props.getProperty('SHEET_ID')   || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';

  if (!upc) {
    return { found: false, reason: 'invalid_length', sent: String(raw || ''), __ver: 'v5' };
  }

  let ss, sh;
  try {
    ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  } catch (e) {
    return { found: false, reason: 'sheet_open_failed', detail: String(e), __ver: 'v5' };
  }
  sh = ss.getSheetByName(sheetName);
  if (!sh) {
    return { found: false, reason: 'sheet_not_found', sheetName, __ver: 'v5' };
  }

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return { found: false, reason: 'empty_sheet', rows: values.length, __ver: 'v5' };
  }

  const headers = values[0].map(String);
  const idxUPC = headers.indexOf('UPC');
  if (idxUPC === -1) {
    return { found: false, reason: 'upc_header_missing', headers, expect: 'UPC', __ver: 'v5' };
  }

  const samples = [];
  let hit = null;
  for (let r = 1; r < values.length; r++) {
    const cellNorm = normalizeUPC_(values[r][idxUPC]);
    if (samples.length < 6 && cellNorm) samples.push(cellNorm);
    if (cellNorm === upc) {
      const rec = {};
      headers.forEach((h, i) => rec[h] = values[r][i]);
      hit = rec; break;
    }
  }

  if (!hit) {
    return {
      found: false,
      upc,
      reason: 'not_found',
      samples,
      sheet: { id: sheetId || '(active)', name: sheetName, header: 'UPC' },
      __ver: 'v5'
    };
  }

  return { found: true, upc, item: hit, __ver: 'v5' };
}