'use strict';
const STATUSES = new Set(['verified','submitted','accepted','needsAttention']);
const PROVIDERS = new Set(['OneTrust','Cookiebot','Didomi','TrustArc','Sourcepoint','Generic']);
let writes = Promise.resolve();
let modelBusy = false;
const hostOf = url => { try { const u=new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname : null; } catch { return null; } };
function serial(task) { const result=writes.then(task); writes=result.catch(()=>{}); return result; }
async function native(message) {
  let timer;
  try {
    return await Promise.race([
      browser.runtime.sendNativeMessage('com.nbonamy.CookieEater',message),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({model:'timeout',action:'none'}),20000);})
    ]);
  } catch { return {model:'bridgeUnavailable',action:'none'}; }
  finally { clearTimeout(timer); }
}
async function config() {
  const {pausedSites=[],aiEnabled=true}=await browser.storage.local.get(['pausedSites','aiEnabled']);
  return {pausedSites,aiEnabled};
}
browser.runtime.onMessage.addListener((message,sender) => {
  if(!message || typeof message.type!=='string') return;
  const host=hostOf(sender.tab?.url);
  const ui=!sender.tab && sender.url?.startsWith(browser.runtime.getURL(''));
  if(message.type==='state' && host) return serial(async()=>({host,paused:(await config()).pausedSites.includes(host),aiEnabled:(await config()).aiEnabled}));
  if(message.type==='status' && ui) return native({type:'status'});
  if(message.type==='interpret' && (host || ui)) return (async()=>{
    const settings=await config();
    if(!settings.aiEnabled || (host && settings.pausedSites.includes(host)) || modelBusy) return {action:'none',model:modelBusy?'busy':'disabled'};
    if(typeof message.banner!=='string'||message.banner.length>2000||!Array.isArray(message.candidates)||message.candidates.length>24) return {action:'none'};
    modelBusy=true;
    try { return await native({type:'interpret',banner:message.banner,candidates:message.candidates}); }
    finally { modelBusy=false; }
  })();
  if(message.type==='outcome' && host && !sender.tab.incognito) return serial(async()=>{
    if(!STATUSES.has(message.status)) return;
    const {history=[]}=await browser.storage.local.get('history');
    const id=typeof message.id==='string'&&/^[a-f0-9-]{32,36}$/.test(message.id)?message.id:crypto.randomUUID();
    const entry={id,host,frameHost:hostOf(sender.url),status:message.status,provider:PROVIDERS.has(message.provider)?message.provider:'Generic',source:message.source==='model'?'model':'rules',evidence:['cookiebotOptionalCategoriesOff','bannerStillVisible','bannerDismissedWithoutStoredProof','ambiguousControls','interactionLimit','paused','pageChanged','acceptedToContinue','acceptanceClicked','rejectionClicked'].includes(message.evidence)?message.evidence:'ambiguousControls',time:Date.now()};
    await browser.storage.local.set({history:[entry,...history.filter(e=>!(e.id===id&&e.host===host&&e.frameHost===entry.frameHost))].slice(0,100)});
    return {ok:true};
  });
  if(!ui) return;
  if(message.type==='popup') return serial(async()=>{
    const settings=await config();
    const {history=[]}=await browser.storage.local.get('history');
    const [tab]=await browser.tabs.query({active:true,currentWindow:true});
    const host=hostOf(tab?.url);
    return {...settings,history,host,tabId:tab?.id,paused:settings.pausedSites.includes(host)};
  });
  if(message.type==='pause') return serial(async()=>{
    const [tab]=await browser.tabs.query({active:true,currentWindow:true});
    const host=hostOf(tab?.url); if(!host) return {ok:false};
    const settings=await config();
    const pausedSites=new Set(settings.pausedSites);
    if(message.paused) pausedSites.add(host); else pausedSites.delete(host);
    await browser.storage.local.set({pausedSites:[...pausedSites].slice(-200)});
    return {ok:true};
  });
  if(message.type==='retry') return (async()=>{
    const [tab]=await browser.tabs.query({active:true,currentWindow:true});
    if(!hostOf(tab?.url)) return {ok:false};
    try { await browser.tabs.sendMessage(tab.id,{type:'retry'}); return {ok:true}; }
    catch { return {ok:false,error:'Reload this page after allowing website access.'}; }
  })();
  if(message.type==='ai') return serial(()=>browser.storage.local.set({aiEnabled:!!message.enabled}));
  if(message.type==='clearHistory') return serial(()=>browser.storage.local.remove('history'));
});
