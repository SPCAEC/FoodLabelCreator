function aiExtract_(req){
  if (!CFG.ENABLE_AI) throw new Error('AI disabled');
  if (!CFG.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY script property');

  const instructions = [
    "You are extracting product label metadata for pet food/treat packages.",
    "Return strict JSON with keys: brand, productName, flavor, species (Dog|Cat), lifestage (Juvenile|Adult|Senior), ingredients (comma-separated string).",
    "If the image is unclear for any field, set that field to an empty string.",
    "Infer species by imagery/text (dog/cat). Infer lifestage; default Adult unless text like Senior, Puppy, Kitten. Map Puppy/Kitten -> Juvenile.",
    "Use concise brand and productName; flavor is a short descriptor like 'Chicken & Rice'."
  ].join(' ');

  const images = [];
  if (req.frontDataUrl) images.push({type:'input_image', image_url: req.frontDataUrl});
  if (req.ingDataUrl)   images.push({type:'input_image', image_url: req.ingDataUrl});

  const payload = {
    model: CFG.OPENAI_MODEL,
    messages: [{
      role: 'user',
      content: [
        {type:'text', text: instructions},
        ...images
      ]
    }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  };

  const res = UrlFetchApp.fetch(`${CFG.OPENAI_BASE_URL}/chat/completions`, {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${CFG.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  });

  if (res.getResponseCode() >= 300)
    throw new Error(`OpenAI error: ${res.getResponseCode()} ${res.getContentText()}`);

  const txt = JSON.parse(res.getContentText());
  const msgContent = txt.choices?.[0]?.message?.content;

  if (!msgContent)
    console.warn('[aiExtract_] No GPT content returned:', txt);

  const json = JSON.parse(msgContent || '{}');

  const out = {
    brand: (json.brand || '').trim(),
    productName: (json.productName || '').trim(),
    flavor: (json.flavor || '').trim(),
    species: normSpecies_(json.species),
    lifestage: normLifestage_(json.lifestage),
    ingredients: (json.ingredients || '').replace(/\s*,\s*/g, ', ').trim()
  };

  return out;
}