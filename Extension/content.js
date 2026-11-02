/* Runs independently in every permitted HTTP(S) frame; the background owns top-site settings. */
(() => {
  'use strict';
  const CE=globalThis.CookieEater;
  if(!CE || globalThis.__cookieEaterRunning) return;
  globalThis.__cookieEaterRunning=true;
  let epoch=0,busy=false,finished=false,timer,href=location.href,stopped=false,ignoredRoots=new WeakSet();
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const send=msg=>browser.runtime.sendMessage(msg);
  const cookies=()=>{try{return document.cookie;}catch{return '';}};
  function schedule() {
    if(stopped || finished || busy || timer) return;
    timer=setTimeout(()=>{timer=null; run().catch(()=>{finished=true;busy=false;});},400);
  }
  function reset() {epoch++;ignoredRoots=new WeakSet();finished=false;schedule();}
  async function run() {
    if(busy||finished||stopped) return;
    busy=true;
    const settings=await send({type:'state'}).catch(()=>null);
    if(!settings || settings.paused) {busy=false;return;}
    const inspect=()=>CE.inspect(document,{ignoredRoots});
    let snapshot=inspect();
    if(!snapshot) {busy=false;return;}
    const generation=epoch,start=Date.now(),initial=cookies(),provider=snapshot.provider;
    const id=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
    let source='rules',inferences=0,finalAction=null,interactions=0;
    const visited=new Set(),clicked=new WeakSet();
    const current=()=>!stopped && generation===epoch && href===location.href && Date.now()-start<30000;
    const outcome=async(status,evidence)=>{
      if(!current()) return;
      finished=true;
      await send({type:'outcome',id,status,evidence,provider,source}).catch(()=>{});
    };
    try {
      for(let step=0;step<20 && current();step++) {
        const state=await send({type:'state'}).catch(()=>null);
        if(!state || state.paused || !current()) return;
        snapshot=inspect();
        if(!snapshot) {
          // Wait for animations and replacement settings panels before deciding.
          await sleep(700);
          if(!current()) return;
          snapshot=inspect();
          if(!snapshot) {
            if(interactions===0) return; // Unrelated dialogs create no cookie outcome; keep watching for a later banner.
            const result=finalAction==='accept'?{status:'accepted',evidence:'acceptedToContinue'}:finalAction?CE.evidence(initial,cookies(),true,provider): {status:'needsAttention',evidence:'bannerDismissedWithoutStoredProof'};
            await outcome(result.status,result.evidence);return;
          }
        }
        let choice=CE.choose(snapshot,visited,clicked), assessment=null;
        if(!choice && state.aiEnabled && inferences<3) {
          inferences++;
          const supplied=CE.modelCandidates(snapshot,clicked).slice(0,24),dom=CE.domSnapshot(snapshot);
          const result=await send({type:'interpret',banner:snapshot.text.slice(0,500),dom,canSave:CE.modelSaveReady(snapshot),candidates:supplied.map(c=>({id:c.id,label:c.label,text:c.text,state:c.radio?'unselected radio':c.toggle?String(c.state):'button'}))}).catch(()=>null);
          if(!current()) return;
          if(result?.model==='busy'){inferences--;await sleep(1000);continue;}
          const refreshed=inspect();
          // A model reply never survives a changed banner, label, or switch state.
          if(!refreshed || refreshed.root!==snapshot.root || CE.domSnapshot(refreshed)!==dom || supplied.some(c=>!refreshed.candidates.some(live=>live.element===c.element&&live.label===c.label&&live.text===c.text&&live.state===c.state&&live.disabled===c.disabled))) { continue; }
          snapshot=refreshed;
          if(result?.action==='none' && result.scope==='unrelated') {ignoredRoots.add(snapshot.root);continue;}
          if(result && CE.validate(snapshot,result,visited,true)) {
            assessment=result;
            choice={action:result.action,candidate:snapshot.candidates.find(c=>c.id===result.candidateID)};
            source='model';
          }
        }
        if(!choice) {await outcome('needsAttention',interactions?'interactionLimit':'ambiguousControls');return;}
        const {candidate,action}=choice;
        const stateBeforeClick=await send({type:'state'}).catch(()=>null);
        if(!current() || !stateBeforeClick || stateBeforeClick.paused) return;
        const fresh=inspect();
        if(!fresh || fresh.root!==snapshot.root || fresh.text!==snapshot.text) continue;
        const live=fresh.candidates.find(c=>c.element===candidate.element && c.label===candidate.label && c.text===candidate.text && c.state===candidate.state);
        if(!live || !fresh.isVisible(live.element) || !CE.validate(fresh,{...assessment,candidateID:live.id,action},visited,assessment!==null)) continue;
        if(clicked.has(live.element)) {await outcome('needsAttention','interactionLimit');return;}
        clicked.add(live.element);interactions++;
        if(action==='tab') visited.add(live.normalized);
        finalAction=!live.radio && ['reject','save','accept'].includes(action)?action:null;
        live.element.click();
        // Consent frames may disappear on the next task. Preserve the actual click now,
        // then upgrade this same record if the frame stays alive long enough to verify.
        if(finalAction) send({type:'outcome',id,status:action==='accept'?'accepted':'submitted',evidence:action==='accept'?'acceptanceClicked':'rejectionClicked',provider,source}).catch(()=>{});
        await sleep(650);
        if(action==='reject' && live.radio && current()) {
          const after=inspect()?.candidates.find(c=>c.element===live.element);
          if(after?.state!==true) {await outcome('needsAttention','ambiguousControls');return;}
        }
        if(action==='disable' && current()) {
          const after=inspect()?.candidates.find(c=>c.element===live.element);
          if(after && after.state!==false) {await outcome('needsAttention','ambiguousControls');return;}
        }
      }
      if(generation===epoch && !stopped) {
        finished=true;
        await send({type:'outcome',id,status:'needsAttention',evidence:'interactionLimit',provider,source}).catch(()=>{});
      }
    } finally {busy=false;if(generation!==epoch)schedule();}
  }
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','aria-hidden','aria-checked','checked']});
  const watchNavigation=()=>setInterval(()=>{if(location.href!==href){href=location.href;reset();}},1000);
  let navigation=watchNavigation();
  browser.runtime.onMessage.addListener(message=>{if(message?.type==='retry'){reset();return Promise.resolve({ok:true});}});
  browser.storage.onChanged.addListener((changes,area)=>{if(area==='local' && (changes.pausedSites || changes.aiEnabled))reset();});
  addEventListener('pagehide',()=>{epoch++;stopped=true;observer.disconnect();clearTimeout(timer);clearInterval(navigation);});
  addEventListener('pageshow',event=>{if(event.persisted){stopped=false;href=location.href;observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','aria-hidden','aria-checked','checked']});navigation=watchNavigation();reset();}});
  schedule();
})();
