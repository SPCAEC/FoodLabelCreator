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

  const normUPC = normalizeUPC_(payload.upc || '');
  const nameStamp = Date.now();

  // Determine template kind
  const kind = String(
    (payload.type) ||
    (payload.slides && payload.slides.templateKind) ||
    'food'
  ).toLowerCase();
  const templateId = (kind === 'treat')
    ? CFG.SLIDES_TEMPLATE_TREAT_ID
    : CFG.SLIDES_TEMPLATE_FOOD_ID;

  // Open working copy
  const copyName = `Label_${normUPC || 'unknown'}_${nameStamp}`;
  const copy = DriveApp.getFileById(templateId).makeCopy(copyName);
  const pres = SlidesApp.openById(copy.getId());

  // Build placeholder map
  let placeholders = {};
  if (payload.slides && typeof payload.slides.placeholders === 'object') {
    placeholders = payload.slides.placeholders;
  } else {
    placeholders = {
      '{{Species}}': buildSpeciesDisplay_(payload.species, payload.lifestage),
      '{{Brand}}': payload.brand || '',
      '{{ProductName}}': payload.productName || '',
      '{{Flavor}}': payload.flavor || '',
      '{{Expiration}}': payload.expiration || '',
      '{{Ingredients}}': payload.ingredients || ''
    };
  }

  // Support {{upc}} or {{UPC}} if needed
  if (normUPC && placeholders['{{upc}}'] === undefined && placeholders['{{UPC}}'] === undefined) {
    placeholders['{{upc}}'] = normUPC;
  }

  // Replace placeholders on all slides
  const slides = pres.getSlides();
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    for (const key in placeholders) {
      if (placeholders.hasOwnProperty(key)) {
        slide.replaceAllText(key, String(placeholders[key] || ''));
      }
    }
  }

  pres.saveAndClose();

  // Export to PDF
  const blob = DriveApp.getFileById(copy.getId()).getAs('application/pdf');
  const outFile = DriveApp.getFolderById(CFG.OUTPUT_PDF_FOLDER_ID) // ✅ corrected key
    .createFile(blob)
    .setName(copyName + '.pdf');

  // Clean up slide copy
  DriveApp.getFileById(copy.getId()).setTrashed(true);

  // Log success
  logI('Label generated', {
    kind,
    upc: normUPC,
    fileId: outFile.getId(),
    name: outFile.getName()
  });

  return {
    fileId: outFile.getId(),
    url: 'https://drive.google.com/uc?export=download&id=' + outFile.getId()
  };
}