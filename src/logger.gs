/** Small structured logging helper + safe RPC wrapper */
function logI(msg, obj){ console.log(JSON.stringify({level:'info', msg, ...obj})); }
function logE(msg, obj){ console.error(JSON.stringify({level:'error', msg, ...obj})); }

function rpcTry(fn){
  try {
    const data = fn();
    return { ok: true, data };
  } catch (err) {
    logE('rpc error', { error: String(err.stack || err) });
    return { ok: false, message: String(err.message || err) };
  }
}