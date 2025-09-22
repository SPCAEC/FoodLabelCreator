/** Food Label Creator — Apps Script bootstrap */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Example server function (wire up later)
function ping() {
  return { ok: true, at: new Date().toISOString() };
}