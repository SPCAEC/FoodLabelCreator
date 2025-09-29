function aiExtract_(req) {
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
  if (req.frontDataUrl) images.push({ type: 'input_image', image_url: req.frontDataUrl });
  if (req.ingDataUrl) images.push({ type: 'input_image', image_url: req.ingDataUrl });

  const useResponseFormat = CFG.OPENAI_MODEL === 'gpt-4o';

  const payload = {
    model: CFG.OPENAI_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: instructions },
        ...images
      ]
    }],
    temperature: 0.2
  };

  if (useResponseFormat) {
    payload.response_format = { type: 'json_object' };
  }

  console.log('[GPT Payload]', JSON.stringify(payload, null, 2));
  
  const res = UrlFetchApp.fetch(`${CFG.OPENAI_BASE_URL}/chat/completions`, {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${CFG.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  });

  const status = res.getResponseCode();
  const body = res.getContentText();
  console.log('[GPT Response]', body);

  if (status >= 300) {
    throw new Error(`OpenAI error: ${status} ${body}`);
  }

  const parsed = JSON.parse(body);
  const msgContent = parsed.choices?.[0]?.message?.content;

  if (!msgContent) {
    console.warn('[aiExtract_] No GPT content returned:', parsed);
    throw new Error('AI returned no message content');
  }

  let json = {};
  try {
    json = JSON.parse(msgContent);
  } catch (e) {
    console.warn('[aiExtract_] Failed to parse JSON from GPT response:', msgContent);
    throw new Error('Failed to parse JSON response from AI');
  }

  console.log('[Parsed JSON]', JSON.stringify(json, null, 2));
  console.log('[Image Data Lengths]', {
    front: req.frontDataUrl?.length,
    ingredients: req.ingDataUrl?.length
  });

  // Normalize output keys
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

function normSpecies_(val) {
  const s = String(val || '').toLowerCase();
  if (s.includes('dog')) return 'Dog';
  if (s.includes('cat')) return 'Cat';
  return '';
}

function normLifestage_(val) {
  const s = String(val || '').toLowerCase();
  if (s.includes('juvenile') || s.includes('puppy') || s.includes('kitten')) return 'Juvenile';
  if (s.includes('senior')) return 'Senior';
  if (s.includes('adult')) return 'Adult';
  return '';
}