/** Code.gs — doGet and templating */
function doGet() {
  const t = HtmlService.createTemplateFromFile('ui/Index');
  t.CONFIG = {
    enableScandit: CFG.ENABLE_SCANDIT,
    scanditLicense: CFG.SCANDIT_LICENSE
  };
  return t.evaluate()
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}