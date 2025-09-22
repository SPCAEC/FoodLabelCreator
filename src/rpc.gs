/** rpc.gs — endpoints called from the client */

function apiLookup(upc) {
  try {
    if (!upc || !/^\d{12}$/.test(String(upc))) {
      return { ok:false, message:'Please enter a 12-digit UPC.' };
    }
    const found = lookupProductByUpc(String(upc));
    if (!found) return { ok:true, data: { found:false } };

    const { rowIndex, data } = found;
    return {
      ok: true,
      data: {
        found: true,
        rowIndex,
        record: data
      }
    };
  } catch (err) {
    return { ok:false, message: String(err) };
  }
}