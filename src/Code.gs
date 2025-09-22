/** Food Label Creator — Web App bootstrap + static proxy + APIs */

/* ------------------------------------------------------------------ */
/*  SAME-ORIGIN STATIC PROXY (Scandit bundled JS only)                 */
/*  We proxy ONLY the JS bundle to avoid ORB/CSP blocking of <script>. */
/*  The engineLocation (WASM files) will still be fetched from Scandit */
/*  CDN by the SDK at runtime.                                         */
/* ------------------------------------------------------------------ */
const SCANDIT_BUNDLED_JS =
  'https://cdn.jsdelivr.net/npm/scandit-web-datacapture-bundled@7.6.1/build/js/index.min.js';

function serveScanditBundled_() {
  const res  = UrlFetchApp.fetch(SCANDIT_BUNDLED_JS, {
    muteHttpExceptions: true,
    followRedirects: true,
  });
  const code = res.getResponseCode();

  console.log(JSON.stringify({
    level: 'info',
    msg: 'static fetch',
    from: SCANDIT_BUNDLED_JS,
    status: code,
  }));

  if (code !== 200) {
    return ContentService
      .createTextOutput('/* failed to fetch Scandit bundle: ' + code + ' */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(res.getContentText('UTF-8'))
    .setMimeType(ContentService.MimeType.JAVASCRIPT)        // IMPORTANT: execute as JS
    .setHeader('Cache-Control', 'public, max-age=31536000'); // cache hard; bump version to bust
}

/* ------------------------------------------------------------------ */
/*  doGet router                                                       */
/*  - ?static=scandit-index  -> serves Scandit bundled JS (same-origin)*/
/*  - otherwise: render app HTML (and expose baseUrl to client)        */
/* ------------------------------------------------------------------ */
function doGet(e) {
  const p = e && e.parameter && e.parameter.static;
  if (p) {
    if (p === 'scandit-index') return serveScanditBundled_();
    // Unknown static path -> neutral JS response
    return ContentService
      .createTextOutput('/* unknown static route */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const tpl = HtmlService.createTemplateFromFile('ui/Index');
  tpl.cacheBust = Date.now();
  // Expose absolute base URL so client can build same-origin URLs
  try { tpl.baseUrl = ScriptApp.getService().getUrl() || ''; }
  catch (_) { tpl.baseUrl = ''; }

  return tpl
    .evaluate()
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Server-side include for HtmlService templates. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ------------------------------------------------------------------ */
/*  UPC utilities + Lookup API (diagnostic-friendly, forgiving)        */
/* ------------------------------------------------------------------ */

/** Normalize to 12-digit UPC-A (forgiving). */
function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1); // EAN-13 -> UPC-A
  if (s.length > 13) return '';
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');  // recover lost leading zeros
  return s.length === 12 ? s : '';
}

/** Lookup by UPC against configured sheet; returns UI-ready shape with diagnostics. */
function apiLookup(payload) {
  const raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
  const upc = normalizeUPC_(raw);

  const props     = PropertiesService.getScriptProperties();
  const sheetId   = props.getProperty('SHEET_ID')   || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';

  if (!upc) {
    return { found: false, reason: 'invalid_length', sent: String(raw || ''), __ver: 'v6' };
  }

  let ss, sh;
  try {
    ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  } catch (e) {
    return { found: false, reason: 'sheet_open_failed', detail: String(e), __ver: 'v6' };
  }
  sh = ss.getSheetByName(sheetName);
  if (!sh) {
    return { found: false, reason: 'sheet_not_found', sheetName, __ver: 'v6' };
  }

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return { found: false, reason: 'empty_sheet', rows: values.length, __ver: 'v6' };
  }

  const headers = values[0].map(String);
  const idxUPC = headers.indexOf('UPC');
  if (idxUPC === -1) {
    return { found: false, reason: 'upc_header_missing', headers, expect: 'UPC', __ver: 'v6' };
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
      __ver: 'v6'
    };
  }

  return { found: true, upc, item: hit, __ver: 'v6' };
}