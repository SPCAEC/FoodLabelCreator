/** Slides → PDF generator (food vs treat template) */

function buildSpeciesDisplay_(species, lifestage){
  const s = String(species || '').trim();
  const l = String(lifestage || '').trim().toLowerCase();
  if (l === 'senior' && s) return `Senior ${s}`;
  if (l === 'juvenile' && s.toLowerCase() === 'dog') return 'Puppy';
  if (l === 'juvenile' && s.toLowerCase() === 'cat') return 'Kitten';
  return s || '';
}

function generateLabelPDF_(payload){
  const templateId = (String(payload.type).toLowerCase()==='treat')
    ? CFG.SLIDES_TEMPLATE_TREAT_ID
    : CFG.SLIDES_TEMPLATE_FOOD_ID;

  const copy = DriveApp.getFileById(templateId).makeCopy(`Label_${payload.upc}_${Date.now()}`);
  const pres = SlidesApp.openById(copy.getId());
  const body = pres.getSlides();

  const speciesDisplay = buildSpeciesDisplay_(payload.species, payload.lifestage);

  // Replace placeholders across all slides
  body.forEach(sl=>{
    replaceAllText_(sl, '{{Species}}', speciesDisplay);
    replaceAllText_(sl, '{{Brand}}', payload.brand || '');
    replaceAllText_(sl, '{{ProductName}}', payload.productName || '');
    replaceAllText_(sl, '{{Flavor}}', payload.flavor || '');
    replaceAllText_(sl, '{{Expiration}}', payload.expiration || ''); // mm/dd/yyyy passed from UI
    replaceAllText_(sl, '{{Ingredients}}', payload.ingredients || '');
    replaceAllText_(sl, '{{upc}}', payload.upc || ''); // if your template wants it
  });

  pres.saveAndClose();

  // Export to PDF
  const blob = DriveApp.getFileById(copy.getId()).getAs('application/pdf');
  const out = DriveApp.getFolderById(CFG.OUTPUT_PDF_FOLDER_ID).createFile(blob).setName(`Label_${payload.upc}_${Date.now()}.pdf`);
  // Clean up slide copy
  DriveApp.getFileById(copy.getId()).setTrashed(true);

  return { fileId: out.getId(), url: `https://drive.google.com/uc?export=download&id=${out.getId()}` };
}

function replaceAllText_(slide, placeholder, value){
  const shapes = slide.getPageElements();
  shapes.forEach(el=>{
    if (el.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
      const tf = el.asShape().getText();
      const range = tf.find(placeholder);
      if (range) tf.replaceAllText(placeholder, value);
    }
  });
}}