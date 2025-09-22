/** UI-callable APIs (always return {ok, data?|message}) */
function apiLookup(upc){ return rpcTry(()=> {
  if (!upc || !/^\d{12}$/.test(String(upc))) throw new Error('UPC must be 12 digits');
  const rec = readByUPC(upc);
  return { found: !!rec, record: rec || null };
});}

function apiSaveAndCreateLabel(payload){ return rpcTry(()=> {
  // payload: { upc, species, lifestage, brand, productName, flavor, ingredients, expiration, type }
  if (!payload?.upc) throw new Error('Missing UPC');
  if (!payload?.expiration) throw new Error('Missing expiration date (mm/dd/yyyy)');
  // generate PDF first
  const pdf = generateLabelPDF_(payload);
  // upsert to sheet (note: we do NOT store expiration per your spec)
  const row = upsertRecord({
    ...payload,
    pdfFileId: pdf.fileId,
    pdfUrl: pdf.url,
  });
  return { row, pdf };
});}

function apiUploadFront(upc, dataUrl){ return rpcTry(()=> {
  if (!upc || !dataUrl) throw new Error('Missing image or UPC');
  const f = saveImage_(upc, dataUrl, 'front');
  return f;
});}

function apiUploadIngredients(upc, dataUrl){ return rpcTry(()=> {
  if (!upc || !dataUrl) throw new Error('Missing image or UPC');
  const f = saveImage_(upc, dataUrl, 'ingredients');
  return f;
});}

function apiExtractFromImages(req){ return rpcTry(()=> {
  // req: { upc, frontDataUrl?, ingDataUrl? }
  const out = aiExtract_(req);
  return out;
});}