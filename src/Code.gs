/** Food Label Creator — Web App bootstrap + APIs + inline Scandit bundle */

/* ------------------------------------------------------------------ */
/*  Inline Scandit bundle (Core+Barcode)                               */
/*  - Fetches the bundled JS and escapes </script> so inline execution */
/*    cannot be terminated early by the browser.                       */
/*  - Guarantees window.Scandit is defined before js.scanner runs.     */
/* ------------------------------------------------------------------ */
function scanditBundleInline() {
  const url = 'https://cdn.jsdelivr.net/npm/scandit-web-datacapture-bundled@7.6.1/build/js/index.min.js';
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  const code = res.getResponseCode();
  console.log(JSON.stringify({ level: 'info', msg: 'inline scandit fetch', url, status: code }));
  if (code !== 200) return '/* failed to fetch Scandit bundle: ' + code + ' */';
  // IMPORTANT: prevent premature </script> termination in inline context
  return res.getContentText('UTF-8').replace(/<\/script>/gi, '<\\/script>');
}

/* ------------------------------------------------------------------ */
/*  doGet: render app HTML and expose baseUrl (optional)               */
/* ------------------------------------------------------------------ */
function doGet(e) {
  const tpl = HtmlService.createTemplateFromFile('ui/Index');
  tpl.cacheBust = Date.now();
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
    return { found: false, reason: 'invalid_length', sent: String(raw || ''), __ver: 'v7' };
  }

  let ss, sh;
  try {
    ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  } catch (e) {
    return { found: false, reason: 'sheet_open_failed', detail: String(e), __ver: 'v7' };
  }
  sh = ss.getSheetByName(sheetName);
  if (!sh) {
    return { found: false, reason: 'sheet_not_found', sheetName, __ver: 'v7' };
  }

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return { found: false, reason: 'empty_sheet', rows: values.length, __ver: 'v7' };
  }

  const headers = values[0].map(String);
  const idxUPC = headers.indexOf('UPC');
  if (idxUPC === -1) {
    return { found: false, reason: 'upc_header_missing', headers, expect: 'UPC', __ver: 'v7' };
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
      __ver: 'v7'
    };
  }

  return { found: true, upc, item: hit, __ver: 'v7' };
}