/** slides.labels.gs — Placeholder mapping & PDF generation */

function computeSpeciesLabel_(species, lifestage) {
  const s = (String(species||'').trim().toLowerCase());
  const l = (String(lifestage||'').trim().toLowerCase());
  if (l === 'senior') return `Senior ${s === 'dog' ? 'Dog' : 'Cat'}`;
  if (l === 'juvenile') return s === 'dog' ? 'Puppy' : 'Kitten';
  // adult or blank → just species
  return s === 'dog' ? 'Dog' : 'Cat';
}

function generateLabelPdf_(record, expirationMMDDYYYY) {
  // Decide template by Treat/Food
  const isTreat = String(record[COL.TYPE] || '').toLowerCase() === 'treat';
  const templateId = isTreat ? CFG.SLIDES_TREAT_ID : CFG.SLIDES_FOOD_ID;

  // Copy template
  const copy = DriveApp.getFileById(templateId).makeCopy(
    `[TEMP] ${record[COL.BRAND] || ''} ${record[COL.PRODUCT] || ''} ${new Date().toISOString()}`,
    DriveApp.getFolderById(CFG.PDF_FOLDER_ID) // temp location; we will move/export
  );
  const pres = SlidesApp.openById(copy.getId());

  // Build replacements
  const speciesLabel = computeSpeciesLabel_(record[COL.SPECIES], record[COL.LIFESTAGE]);
  const map = new Map([
    ['{{Species}}', speciesLabel],
    ['{{Brand}}', record[COL.BRAND] || ''],
    ['{{ProductName}}', record[COL.PRODUCT] || ''],
    ['{{Flavor}}', record[COL.FLAVOR] || ''],
    ['{{Expiration}}', expirationMMDDYYYY || ''],
    ['{{Ingredients}}', record[COL.INGREDIENTS] || '']
  ]);

  // Replace placeholders
  pres.getSlides().forEach(slide => {
    map.forEach((val, key) => slide.replaceAllText(key, String(val)));
  });

  // Export to PDF
  const pdfBlob = DriveApp.getFileById(copy.getId()).getAs(MimeType.PDF);
  const pdfFile = DriveApp.getFolderById(CFG.PDF_FOLDER_ID)
    .createFile(pdfBlob)
    .setName(`${record[COL.BRAND]||'Brand'}_${record[COL.PRODUCT]||'Product'}_${new Date().toISOString().replace(/[:.]/g,'-')}.pdf`);

  // Cleanup slide copy to avoid clutter
  DriveApp.getFileById(copy.getId()).setTrashed(true);

  return { fileId: pdfFile.getId(), url: pdfFile.getUrl() };
}