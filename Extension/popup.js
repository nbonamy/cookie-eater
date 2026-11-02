'use strict';
const $=selector=>document.querySelector(selector);
const send=message=>browser.runtime.sendMessage(message);
const descriptions={accepted:'Accepted to continue',verified:'Optional cookies rejected',submitted:'Rejection requested · unverified',needsAttention:'Needs your attention'};
const short={accepted:'Accepted',verified:'Verified',submitted:'Requested',needsAttention:'Needs attention'};
let state;
async function refresh(){
  state=await send({type:'popup'});
  $('#host').textContent=state.host||'Open a website in Safari';
  $('#active').disabled=!state.host;$('#active').checked=!state.paused&&!!state.host;
  $('#ai').checked=state.aiEnabled;$('#retry').disabled=!state.host||state.paused;
  const last=state.history.find(e=>e.host===state.host);
  $('#outcome').textContent=state.paused?'Paused for this website':last?descriptions[last.status]:'Reject when possible. Accept when required.';
  $('#history').replaceChildren();
  for(const entry of state.history.slice(0,8)){
    const li=document.createElement('li'),host=document.createElement('span'),outcome=document.createElement('span');
    host.className='history-host';host.textContent=entry.host;
    outcome.className='history-outcome';outcome.textContent=short[entry.status];
    li.title=`${new Date(entry.time).toLocaleString()} · ${entry.provider} · ${entry.source==='model'?'Apple Intelligence':'Bundled rules'} · ${entry.evidence}`;
    li.append(host,outcome);$('#history').append(li);
  }
  if(!state.history.length){const li=document.createElement('li');li.className='empty';li.textContent='Your cookie choices will appear here.';$('#history').append(li);}
  $('#clear').disabled=!state.history.length;
}
async function availability(){
 const r=await send({type:'status'});
 const labels={available:'On-device interpretation for unfamiliar banners.',deviceNotEligible:'This Mac uses bundled rules.',appleIntelligenceNotEnabled:'Turn on Apple Intelligence in System Settings to interpret unfamiliar banners.',modelNotReady:'Apple Intelligence is getting ready. Bundled rules are active.',unsupportedOS:'Apple Intelligence requires macOS 26 or later. Bundled rules are active.',bridgeUnavailable:'Open Cookie Eater and reload Safari to reconnect. Bundled rules are active.',timeout:'Apple Intelligence is taking longer than expected. Bundled rules are active.'};
 $('#model').textContent=labels[r.model]||'Apple Intelligence is unavailable. Bundled rules are active.';
}
async function action(task){try{await task();await refresh();}catch{$('#message').textContent='Couldn’t update Cookie Eater. Close this popup and try again.';}}
$('#active').onchange=()=>action(()=>send({type:'pause',paused:!$('#active').checked}));
$('#ai').onchange=()=>action(()=>send({type:'ai',enabled:$('#ai').checked}));
$('#clear').onclick=()=>action(()=>send({type:'clearHistory'}));
$('#retry').onclick=()=>action(async()=>{const r=await send({type:'retry'});$('#message').textContent=r.ok?'Checking this page again…':r.error||'Open a website and try again.';});
$('#probe').onclick=async()=>{
 $('#probe').disabled=true;$('#diagnostic').textContent='Asking the on-device model…';
 try{const r=await send({type:'interpret',banner:'We use cookies. Choose your privacy preferences.',candidates:[{id:'c0',label:'Allow all cookies'},{id:'c1',label:'Decline optional cookies'}]});$('#diagnostic').textContent=r.action==='reject'&&r.candidateID==='c1'?'Connected. The model selected “Decline optional cookies.”':`No action selected (${r.model||'unavailable'}). Bundled rules are active.`;}
 catch{$('#diagnostic').textContent='Connection failed. Open Cookie Eater and try again.';}finally{$('#probe').disabled=false;}
};
browser.storage.onChanged.addListener((_,area)=>{if(area==='local')refresh().catch(()=>{});});
Promise.all([refresh(),availability()]).catch(()=>{$('#message').textContent='Couldn’t connect. Reopen this popup to try again.';});
