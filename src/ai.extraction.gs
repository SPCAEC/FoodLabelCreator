/** AI Extraction Service – OpenAI Vision → Structured Label Metadata */

function aiExtract_(req) {
  if (!CFG.ENABLE_AI) throw new Error('AI disabled');
  if (!CFG.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY script property');

  const instructions = [
    "You are extracting product label metadata for pet food/treat packages.",
    "Return strict JSON with keys: brand, productName, flavor, species (Dog|Cat), lifestage (Juvenile|Adult|Senior), ingredients (comma-separated string).",
    "If the image is unclear for any field, set that field to an empty string. Do not guess or make assumptions",
    "Infer species by imagery/text (dog/cat). Infer lifestage; default Adult unless text like Senior, Puppy, Kitten. Map Puppy/Kitten -> Juvenile.",
    "Use concise brand and productName; flavor is a short descriptor like 'Chicken & Rice'."
  ].join(' ');

  const images = [];
  if (req.frontDataUrl) {
    images.push({ type: 'image_url', image_url: { url: req.frontDataUrl } });
  }
  if (req.ingDataUrl) {
    images.push({ type: 'image_url', image_url: { url: req.ingDataUrl } });
  }
  
  console.log('[Image Data Lengths]', {
    front: front?.length,
    ingredients: ingredients?.length
  });
  console.log('[Front Preview]', front?.slice(0, 100));
  console.log('[Ingredients Preview]', ingredients?.slice(0, 100));
  
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

  if (CFG.OPENAI_MODEL === 'gpt-4o') {
    payload.response_format = { type: 'json_object' };
  }

  console.log('[GPT Payload]', JSON.stringify(payload, null, 2));

  const response = UrlFetchApp.fetch(`${CFG.OPENAI_BASE_URL}/chat/completions`, {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${CFG.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  });

  const status = response.getResponseCode();
  const rawBody = response.getContentText();
  console.log('[GPT Response]', rawBody);

  if (status >= 300) {
    throw new Error(`OpenAI error ${status}: ${rawBody}`);
  }

  const parsed = JSON.parse(rawBody);
  const msg = parsed.choices?.[0]?.message?.content;

  if (!msg) {
    console.warn('[aiExtract_] No content in GPT response:', parsed);
    throw new Error('AI returned no message content');
  }

  let rawJson;
  try {
    rawJson = JSON.parse(msg);
  } catch (e) {
    console.warn('[aiExtract_] Invalid JSON content:', msg);
    throw new Error('Failed to parse AI response as JSON');
  }

  console.log('[Parsed JSON]', JSON.stringify(rawJson, null, 2));
  console.log('[Image Data Lengths]', {
    front: req.frontDataUrl?.length,
    ingredients: req.ingDataUrl?.length
  });

  return {
    brand:        (rawJson.brand || '').trim(),
    productName:  (rawJson.productName || '').trim(),
    flavor:       (rawJson.flavor || '').trim(),
    species:      normSpecies_(rawJson.species),
    lifestage:    normLifestage_(rawJson.lifestage),
    ingredients:  (rawJson.ingredients || '').replace(/\s*,\s*/g, ', ').trim()
  };
}

// Normalize species string → "Dog" | "Cat" | ""
function normSpecies_(val) {
  const s = String(val || '').toLowerCase();
  if (s.includes('dog')) return 'Dog';
  if (s.includes('cat')) return 'Cat';
  return '';
}

// Normalize lifestage → "Juvenile" | "Adult" | "Senior" | ""
function normLifestage_(val) {
  const s = String(val || '').toLowerCase();
  if (s.includes('juvenile') || s.includes('puppy') || s.includes('kitten')) return 'Juvenile';
  if (s.includes('senior')) return 'Senior';
  if (s.includes('adult')) return 'Adult';
  return '';
}