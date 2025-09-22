/** Food Label Creator — App bootstrap + HTML templating */

function doGet(e) {
  const tpl = HtmlService.createTemplateFromFile('ui/Index'); // root HTML template
  tpl.cacheBust = Date.now(); // available to HTML if you want ?v= cache-buster
  return tpl
    .evaluate()
    .setTitle('Food Label Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Server-side include helper for HtmlService templates.
 * Usage in HTML: <?!= include('ui/js.app'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}