/** Store images under a subfolder per-UPC. Returns {folderId, fileId}. */
function saveImage_(upc, dataUrl, kind) {
  const upc12 = normalizeUPC_(upc);
  if (!upc12) throw new Error(`saveImage_: Invalid or missing UPC (${upc})`);

  const rootId = CFG.IMAGES_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('CFG.IMAGES_ROOT_FOLDER_ID is not set');

  const root = DriveApp.getFolderById(rootId);
  const folderName = `UPC_${upc12}`;
  const folder = getOrCreateSub_(root, folderName);

  const blob = dataUrlToBlob_(dataUrl).setName(`${kind}_${Date.now()}.jpg`);
  const file = folder.createFile(blob);

  logI('Image saved', { kind, upc: upc12, fileId: file.getId(), folderId: folder.getId() });

  return { folderId: folder.getId(), fileId: file.getId() };
}

function getOrCreateSub_(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function dataUrlToBlob_(dataUrl) {
  const parts = dataUrl.split(',');
  const contentType = parts[0].match(/:(.*?);/)[1];
  const bytes = Utilities.base64Decode(parts[1]);
  return Utilities.newBlob(bytes, contentType);
}