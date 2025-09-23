/** Food Label Creator — Web App bootstrap + APIs + Scandit inline helper */

// ---------- Inline Scandit bundle (Core+Barcode) with proper </script> escaping ----------
function scanditBundleInline() {
  var url = 'https://cdn.jsdelivr.net/npm/scandit-web-datacapture-bundled@7.6.1/build/js/index.min.js';
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  var code = resp.getResponseCode();
  if (code !== 200) {
    // Keep page working; js.scanner will prompt fallback if needed
    return '/* failed to fetch Scandit bundle: ' + code + ' */';
  }
  var js = resp.getContentText('UTF-8');

  // Escape closing </script> so the inline tag isn’t terminated by the bundle.
  // Also add a sourceURL so devtools shows a readable name.
  js = js.replace(/<\/script>/gi, '<\\/script>') + '\n//# sourceURL=scandit-bundled-inline.js';

  return js;
}

// ---------- App HTML ----------
function doGet() {
  var tpl = HtmlService.createTemplateFromFile('ui/Index');
  tpl.cacheBust = Date.now();
  return tpl
    .evaluate()
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------- HTML include ----------
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---------- UPC normalize (forgiving) ----------
function normalizeUPC_(v) {
  var s = String(v == null ? '' : v).replace(/\D/g, '');
  if (s.length === 13 && s.charAt(0) === '0') s = s.slice(1); // EAN-13 -> UPC-A
  if (s.length > 13) return '';
  if (s.length > 0 && s.length < 12) s = s.padStart(12, '0');
  return s.length === 12 ? s : '';
}

// ---------- Lookup API ----------
function apiLookup(payload) {
  var raw = (payload && typeof payload === 'object' && 'upc' in payload) ? payload.upc : payload;
  var upc = normalizeUPC_(raw);

  var props     = PropertiesService.getScriptProperties();
  var sheetId   = props.getProperty('SHEET_ID')   || '';
  var sheetName = props.getProperty('SHEET_NAME') || 'Products';

  if (!upc) return { found:false, reason:'invalid_length', sent:String(raw||''), __ver:'v7' };

  var ss;
  try { ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive(); }
  catch (e) { return { found:false, reason:'sheet_open_failed', detail:String(e), __ver:'v7' }; }

  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { found:false, reason:'sheet_not_found', sheetName:sheetName, __ver:'v7' };

  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { found:false, reason:'empty_sheet', rows:values.length, __ver:'v7' };

  var headers = values[0].map(String);
  var idxUPC  = headers.indexOf('UPC');
  if (idxUPC === -1) return { found:false, reason:'upc_header_missing', headers:headers, expect:'UPC', __ver:'v7' };

  var hit = null, samples = [];
  for (var r = 1; r < values.length; r++) {
    var norm = normalizeUPC_(values[r][idxUPC]);
    if (samples.length < 6 && norm) samples.push(norm);
    if (norm === upc) {
      var rec = {};
      headers.forEach(function(h,i){ rec[h] = values[r][i]; });
      hit = rec; break;
    }
  }
  if (!hit) return { found:false, upc:upc, reason:'not_found', samples:samples,
                     sheet:{ id:sheetId||'(active)', name:sheetName, header:'UPC' }, __ver:'v7' };

  return { found:true, upc:upc, item:hit, __ver:'v7' };
}