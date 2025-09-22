/** Slides → PDF generator (food vs treat template) */

function buildSpeciesDisplay_(species, lifestage) {
  const s = String(species || '').trim();
  const l = String(lifestage || '').trim().toLowerCase();
  if (l === 'senior' && s) return 'Senior ' + s;
  if (l === 'juvenile' && s.toLowerCase() === 'dog') return 'Puppy';
  if (l === 'juvenile' && s.toLowerCase() === 'cat') return 'Kitten';
  return s || '';
}

/**
 * Accepts either:
 *  - Flat payload: { type, upc, species, lifestage, brand, productName, flavor, expiration, ingredients }
 *  - Nested payload: { upc, slides: { templateKind, placeholders: { '{{Species}}':..., ... } } }
 */
function generateLabelPDF_(payload) {
  if (!payload) throw new Error('generateLabelPDF_: missing payload');

  // Determine template
  const kind = String(
    (payload.type) ||
    (payload.slides && payload.slides.templateKind) ||
    'food'
  ).toLowerCase();
  const templateId = (kind === 'treat')
    ? CFG.SLIDES_TEMPLATE_TREAT_ID
    : CFG.SLIDES_TEMPLATE_FOOD_ID;

  // Open working copy
  const nameStamp = Date.now();
  const copy = DriveApp.getFileById(templateId).makeCopy('Label_' + (payload.upc || 'unknown') + '_' + nameStamp);
  const pres = SlidesApp.openById(copy.getId());

  // Build placeholder map
  var placeholders = (payload.slides && payload.slides.placeholders) ? payload.slides.placeholders : {
    '{{Species}}': buildSpeciesDisplay_(payload.species, payload.lifestage),
    '{{Brand}}': payload.brand || '',
    '{{ProductName}}': payload.productName || '',
    '{{Flavor}}': payload.flavor || '',
    '{{Expiration}}': payload.expiration || '', // mm/dd/yyyy from UI
    '{{Ingredients}}': payload.ingredients || ''
  };

  // Optionally support {{upc}} if present in template
  if (payload.upc && placeholders['{{upc}}'] === undefined && placeholders['{{UPC}}'] === undefined) {
    placeholders['{{upc}}'] = String(payload.upc);
  }

  // Replace across all slides
  const slides = pres.getSlides();
  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    for (var key in placeholders) {
      if (placeholders.hasOwnProperty(key)) {
        slide.replaceAllText(key, String(placeholders[key] || ''));
      }
    }
  }

  pres.saveAndClose();

  // Export to PDF and store
  const blob = DriveApp.getFileById(copy.getId()).getAs('application/pdf');
  const outFile = DriveApp.getFolderById(CFG.OUTPUT_FOLDER_ID) // <-- corrected key
    .createFile(blob)
    .setName('Label_' + (payload.upc || 'unknown') + '_' + nameStamp + '.pdf');

  // Clean up slide copy
  DriveApp.getFileById(copy.getId()).setTrashed(true);

  return {
    fileId: outFile.getId(),
    url: 'https://drive.google.com/uc?export=download&id=' + outFile.getId()
  };
}