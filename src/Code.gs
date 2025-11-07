/** ---------------------------------------------------------------------------
 * Food Label Creator — Web App bootstrap + API logic
 * Updated for unified JSON responses compatible with js.app.html
 * ---------------------------------------------------------------------------
 */

/* -------------------- HTML bootstrap -------------------- */

/**
 * Serves the web app UI.
 */
function doGet() {
  const tpl = HtmlService.createTemplateFromFile('ui/Index');
  tpl.cacheBust = Date.now(); // prevent stale cached HTML
  return tpl
    .evaluate()
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTML templating include helper.
 */
function include(filename) {
  const file = HtmlService.createHtmlOutputFromFile(filename);
  const content = file.getContent();
  return content;  // ✅ returns raw HTML including <script> tags
}

/* -------------------- UPC utils -------------------- */

/**
 * Normalize any UPC/EAN input to 12-digit UPC-A.
 */
function normalizeUPC_(v) {
  let s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1); // EAN-13 → UPC-A
  if (s.length > 13) return '';
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');  // recover leading zeros
  return s.length === 12 ? s : '';
}

/* -------------------- Lookup API -------------------- */

/**
 * Lookup by UPC against configured sheet; returns unified API response:
 * { ok:true, data:{ found:boolean, item:Object|null, upc:String, reason?:String } }
 */
function apiLookup(payload) {
  const raw = (payload && typeof payload === 'object' && 'upc' in payload)
    ? payload.upc
    : payload;

  const upc = normalizeUPC_(raw);
  const props     = PropertiesService.getScriptProperties();
  const sheetId   = props.getProperty('SHEET_ID')   || '';
  const sheetName = props.getProperty('SHEET_NAME') || 'Products';

  // Invalid UPC
  if (!upc) {
    return {
      ok: false,
      data: { found: false, reason: 'invalid_length', sent: String(raw || '') },
      __ver: 'cdn-v2'
    };
  }

  let ss, sh;
  try {
    ss = sheetId
      ? SpreadsheetApp.openById(sheetId)
      : SpreadsheetApp.getActive();
    sh = ss.getSheetByName(sheetName);
    if (!sh) throw new Error(`Sheet not found: ${sheetName}`);
  } catch (e) {
    Logger.log(`[apiLookup] open sheet failed: ${e}`);
    return {
      ok: false,
      data: { found: false, reason: 'sheet_open_failed', detail: String(e) },
      __ver: 'cdn-v2'
    };
  }

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return {
      ok: true,
      data: { found: false, reason: 'empty_sheet', rows: values.length },
      __ver: 'cdn-v2'
    };
  }

  const headers = values[0].map(String);
  const idxUPC  = headers.indexOf('UPC');
  if (idxUPC === -1) {
    return {
      ok: false,
      data: { found: false, reason: 'upc_header_missing', headers, expect: 'UPC' },
      __ver: 'cdn-v2'
    };
  }

  const samples = [];
  let hit = null;

  for (let r = 1; r < values.length; r++) {
    const norm = normalizeUPC_(values[r][idxUPC]);
    if (samples.length < 6 && norm) samples.push(norm);
    if (norm === upc) {
      const rec = {};
      headers.forEach((h, i) => (rec[h] = values[r][i]));
      hit = rec;
      break;
    }
  }

  // Unified response
  return {
    ok: true,
    data: {
      found: !!hit,
      upc,
      item: hit || null,
      reason: hit ? 'found' : 'not_found',
      sheet: { id: sheetId || '(active)', name: sheetName }
    },
    __ver: 'cdn-v2'
  };
}

/* -------------------- Debug helper -------------------- */

/**
 * Returns lightweight info for verifying ScriptProperties and sheet linkage.
 */
function getConfigDebugInfo() {
  const props = PropertiesService.getScriptProperties();
  return {
    hasSheetId: !!props.getProperty('SHEET_ID'),
    sheetName: props.getProperty('SHEET_NAME'),
    hasPhotosFolder: !!props.getProperty('PHOTOS_FOLDER_ID'),
    hasTemplate: !!props.getProperty('TEMPLATE_ID'),
    hasLabelFolder: !!props.getProperty('LABEL_FOLDER_ID'),
    model: props.getProperty('OPENAI_MODEL'),
    __ver: 'cdn-v2'
  };
}