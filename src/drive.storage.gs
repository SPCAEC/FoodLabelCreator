/** Store images under a subfolder per-UPC. Returns {folderId, fileId}. */
function saveImage_(upc, dataUrl, kind) {
  const root = DriveApp.getFolderById(CFG.IMAGES_ROOT_FOLDER_ID);
  const name = `UPC_${String(upc)}`
  const folder = getOrCreateSub_(root, name);
  const blob = dataUrlToBlob_(dataUrl).setName(`${kind}_${Date.now()}.jpg`);
  const file = folder.createFile(blob);
  return { folderId: folder.getId(), fileId: file.getId() };
}

function getOrCreateSub_(parent, name){
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function dataUrlToBlob_(dataUrl){
  const parts = dataUrl.split(',');
  const contentType = parts[0].match(/:(.*?);/)[1];
  const bytes = Utilities.base64Decode(parts[1]);
  return Utilities.newBlob(bytes, contentType);
}