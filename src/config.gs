/** config.gs — central config & helpers */
const CFG = {
  // Script Properties (set these in: Project Settings → Script properties)
  SHEET_ID:      _prop('SHEET_ID'),
  SHEET_GID:     _prop('SHEET_GID'),          // "0"
  SHEET_NAME:    _prop('SHEET_NAME') || 'Products',
  SLIDES_FOOD_ID:  _prop('SLIDES_FOOD_ID'),
  SLIDES_TREAT_ID: _prop('SLIDES_TREAT_ID'),
  PDF_FOLDER_ID:   _prop('PDF_FOLDER_ID'),
  IMAGES_FOLDER_ID:_prop('IMAGES_FOLDER_ID'),
  OPENAI_API_KEY:  _prop('OPENAI_API_KEY'),
  OPENAI_MODEL:    _prop('OPENAI_MODEL') || 'gpt-5-mini',
  SCANDIT_LICENSE: _prop('SCANDIT_LICENSE'),

  // Feature flags
  ENABLE_SCANDIT: true,
  ENABLE_AI: true
};

// Column names (exactly as provided)
const COL = {
  UPC: 'UPC',
  SPECIES: 'Species',
  LIFESTAGE: 'Lifestage',
  BRAND: 'Brand',
  PRODUCT: 'ProductName',
  FLAVOR: 'Recipe/Flavor',
  TYPE: 'Treat/Food',                // Treat or Food
  INGREDIENTS: 'Ingredients',
  PDF_FILE_ID: 'PDF File ID',
  PDF_URL: 'PDF URL',
  FRONT_PHOTO_ID: 'Front Photo ID',
  ING_PHOTO_ID: 'Ingredients Photo ID',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At'
};

function _prop(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}