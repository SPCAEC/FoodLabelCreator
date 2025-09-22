/** Food Label Creator — App bootstrap + HTML */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('ui/Index')
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}