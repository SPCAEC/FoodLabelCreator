/** Centralized config. Set these in Project Settings → Script Properties. */
const CFG = {
  SHEET_ID: prop_('SHEET_ID'),                // 1ohjJ3g... (set in properties)
  SHEET_GID: '0',                             // provided
  SHEET_NAME: 'Products',                     // change if your tab is different
  SLIDES_TEMPLATE_FOOD_ID: prop_('SLIDES_TEMPLATE_FOOD_ID'),
  SLIDES_TEMPLATE_TREAT_ID: prop_('SLIDES_TEMPLATE_TREAT_ID'),
  OUTPUT_PDF_FOLDER_ID: prop_('OUTPUT_PDF_FOLDER_ID'),
  IMAGES_ROOT_FOLDER_ID: prop_('IMAGES_ROOT_FOLDER_ID'),
  OPENAI_API_KEY: prop_('OPENAI_API_KEY'),
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  OPENAI_MODEL: prop_('OPENAI_MODEL') || 'gpt-5-mini', // as requested
  // Feature toggles
  ENABLE_AI: true,
  ENABLE_SCANDIT: true,
};

function prop_(k){ return PropertiesService.getScriptProperties().getProperty(k); }

const COL = {
  UPC: 'UPC',
  SPECIES: 'Species',
  LIFESTAGE: 'Lifestage',
  BRAND: 'Brand',
  PRODUCT: 'ProductName',
  FLAVOR: 'Recipe/Flavor',
  TYPE: 'Treat/Food',
  INGREDIENTS: 'Ingredients',
  PDF_FILE_ID: 'PDF File ID',
  PDF_URL: 'PDF URL',
  FRONT_PHOTO_ID: 'Front Photo ID',
  ING_PHOTO_ID: 'Ingredients Photo ID',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
};