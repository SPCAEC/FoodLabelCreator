/** sheets.repo.gs — UPC sheet repository */
function _getSheet_() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const sh = ss.getSheetByName(CFG.SHEET_NAME);
  if (!sh) throw new Error(`Sheet "${CFG.SHEET_NAME}" not found`);
  return sh;
}

function _getHeaderMap_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const map = {};
  headers.forEach((h, i) => map[h] = i);
  return { headers, map };
}

function lookupProductByUpc(upc) {
  if (!upc) return null;
  const sh = _getSheet_();
  const { headers, map } = _getHeaderMap_(sh);
  const values = sh.getRange(2, 1, Math.max(sh.getLastRow()-1,0), headers.length).getValues();
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    if (String(row[map[COL.UPC]] || '') === String(upc)) {
      return { rowIndex: r+2, data: _rowToObj_(row, headers) };
    }
  }
  return null;
}

function _rowToObj_(row, headers) {
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

function updateRow(rowIndex, dataObj) {
  const sh = _getSheet_();
  const { headers, map } = _getHeaderMap_(sh);
  const row = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : sh.getRange(rowIndex, map[h]+1).getValue());
  row[map[COL.UPDATED_AT]] = new Date();
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
}

function appendRow(dataObj) {
  const sh = _getSheet_();
  const { headers, map } = _getHeaderMap_(sh);
  const row = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : '');
  const now = new Date();
  if (map[COL.CREATED_AT] !== undefined) row[map[COL.CREATED_AT]] = now;
  if (map[COL.UPDATED_AT] !== undefined) row[map[COL.UPDATED_AT]] = now;
  sh.appendRow(row);
  return sh.getLastRow();
}