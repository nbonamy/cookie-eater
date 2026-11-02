const {test} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const CE = require('../Extension/engine.js');
const assessed=(candidateID,action='reject',extra={})=>({candidateID,action,effect:{reject:'rejectOptionalCookies',settings:'openConsentSettings',disable:'disableOptionalPurpose',save:'saveNecessaryOnly',accept:'acceptToContinue'}[action],requiresPaymentOrAccount:false,alternatives:'rejectionAvailable',...extra});
const page = html => new JSDOM(html, {url:'https://example.com', pretendToBeVisual:true}).window;
const dialog = inner => `<section role="dialog"><h2>Cookie preferences</h2>${inner}</section>`;
function view(html) {const w=page(html); return CE.inspect(w.document, {visible: el=>!el.hidden && !el.closest('[hidden]')});}
test('rejects direct English and French controls', ()=> {
  for (const text of ['Reject all','Tout refuser','Continuer sans accepter']) {
    const s=view(dialog(`<button>${text}</button><button>Accept all</button>`));
    assert.equal(CE.choose(s).action,'reject');
  }
});
test('opens settings when direct rejection is unavailable', ()=> {
  assert.equal(CE.choose(view(dialog('<button>Manage preferences</button><button>Accept all</button>'))).action,'settings');
});
test('never approves misleading or unrelated controls', ()=> {
  for (const text of ['Do not reject all','Reject all and subscribe','Close','Not now','Allow essential and optional cookies','Save and accept all']) {
    const s=view(dialog(`<button>${text}</button>`));
    assert.equal(CE.choose(s),null, text);
    assert.equal(CE.validate(s,{candidateID:'c0',action:'reject'}),false, text);
  }
  assert.equal(view('<article>Cookies recipe <button>Reject all</button></article>'),null);
});
test('does not trust provider selectors with misleading labels',()=>{
  const s=view('<div id="onetrust-banner-sdk">Cookies<button id="onetrust-reject-all-handler">Accept all</button></div>');
  assert.equal(CE.validate(s,{candidateID:'c0',action:'reject'}),false);
});
test('turns off optional and legitimate-interest switches but leaves necessary alone',()=>{
  const s=view(dialog('<label><input type="checkbox" checked disabled>Necessary</label><label><input type="checkbox" checked>Marketing</label><label><input type="checkbox" checked>Legitimate interest</label><button>Save preferences</button>'));
  assert.equal(CE.choose(s).action,'disable');
  assert.match(CE.choose(s).candidate.label,/Marketing/);
  const next=view(dialog('<label><input type="checkbox" checked disabled>Nécessaires</label><label><input type="checkbox">Intérêt légitime</label><button>Enregistrer mes choix</button>'));
  assert.equal(CE.choose(next).action,'save');
});
test('unknown, hidden or indeterminate options prevent saving',()=>{
  for (const toggle of ['<label><input type="checkbox" checked>Partners</label>','<label hidden><input type="checkbox" checked>Marketing</label>']) {
    assert.equal(CE.choose(view(dialog(`${toggle}<button>Save preferences</button>`))),null);
  }
});
test('requires real settings evidence before save',()=>{
  assert.equal(CE.choose(view(dialog('<button>Save preferences</button>'))),null);
});
test('model cannot invent IDs, accept, navigate, or skip enabled switches',()=>{
  const s=view(dialog('<label><input type="checkbox" checked>Marketing</label><button>Save preferences</button><a href="/privacy">Manage preferences</a><button>Accept all</button>'));
  for(const d of [{candidateID:'invented',action:'reject'},{candidateID:'c1',action:'save'},{candidateID:'c2',action:'settings'},{candidateID:'c3',action:'reject'}]) assert.equal(CE.validate(s,d),false);
});
test('persistence is required for verified outcome, disappearance alone is unverified',()=>{
  assert.equal(CE.evidence('','',true).status,'submitted');
  assert.equal(CE.evidence('', 'CookieConsent={necessary:true,preferences:false,statistics:false,marketing:false,method:\'explicit\'}',true).status,'verified');
  assert.equal(CE.evidence('', 'CookieConsent={necessary:true,preferences:true,statistics:false,marketing:false}',true).status,'submitted');
  assert.equal(CE.evidence('CookieConsent=x','CookieConsent=x',true).status,'submitted');
  assert.equal(CE.evidence('','',false).status,'needsAttention');
});
test('prioritizes legitimate interest and vendor tabs before saving',()=>{
  const s=view(dialog('<label><input type="checkbox">Marketing</label><button role="tab">Legitimate interest</button><button>Save preferences</button>'));
  assert.equal(CE.choose(s).action,'tab');
  assert.equal(CE.choose(s,new Set(['legitimate interest'])).action,'save');
});
test('ambiguous or malformed consent storage is never verified',()=>{
  for(const value of ["{necessary:true,preferences:false,statistics:false,marketing:false,method:'explicit',marketing:true}","{necessary:true,preferences:false,statistics:false,marketing:false}","{necessary:true,preferences:false,statistics:false,marketing:'false',method:'explicit'}", "{necessary:true,preferences:false,statistics:false,marketing:false,method:'explicit',broken}"]){
    assert.equal(CE.evidence('','CookieConsent='+encodeURIComponent(value),true,'Cookiebot').status,'submitted');
  }
});
test('model can interpret a safe unfamiliar rejection phrase but never override policy',()=>{
  const s=view(dialog('<button>Use essential cookies only</button><button>Allow all cookies</button>'));
  assert.equal(CE.choose(s),null);
  assert.equal(CE.validate(s,assessed('c0'),new Set(),true),true);
  assert.equal(CE.validate(s,{candidateID:'c1',action:'reject'},new Set(),true),false);
});
test('Libération-style subscribe-or-consent wall chooses acceptance without subscribing',()=>{
  const s=view('<div class="publisher-overlay"><button>Refuser et s’abonner pour 1€ →</button><div><h2>Vos choix de cookies</h2><p>Accepter les cookies ou vous abonner.</p><button>En savoir plus</button><button>Accepter et continuer</button></div></div>');
  assert.equal(s.cookieWall,true);assert.equal(CE.choose(s).action,'accept');assert.equal(CE.choose(s).candidate.label,'Accepter et continuer');
  assert.equal(CE.validate(s,{candidateID:'c0',action:'reject'},new Set(),true),false);
});
test('a free reject control takes priority over a subscription offer',()=>{
  const s=view(dialog('<button>Refuser et s’abonner pour 1€</button><button>Tout refuser</button><button>Accepter et continuer</button>'));
  assert.equal(s.cookieWall,false);assert.equal(CE.choose(s).candidate.label,'Tout refuser');
});

test('accept fallback cannot target subscription, payment, or an ambiguous accept control',()=>{
  const s=view(dialog('<button>Refuser et s’abonner pour 1€</button><button>Accepter et continuer</button><button>Accept and pay</button>'));
  assert.equal(CE.validate(s,{candidateID:'c0',action:'accept'}),false);
  assert.equal(CE.validate(s,{candidateID:'c1',action:'accept'}),true);
  assert.equal(CE.validate(s,{candidateID:'c2',action:'accept'}),false);
  const free=view(dialog('<button>Tout refuser</button><button>Accepter et continuer</button>'));
  assert.equal(CE.validate(free,{candidateID:'c1',action:'accept'}),false);
});

test('a sole explicit cookie acceptance is a fallback, while settings and unknown alternatives block it',()=>{
  const only=view(dialog('<button>Accept all</button>'));
  assert.equal(CE.choose(only).action,'accept');
  const settings=view(dialog('<button>Accept all</button><button>Manage preferences</button>'));
  assert.equal(CE.choose(settings).action,'settings');
  const unknown=view(dialog('<button>Accept all</button><button>No thanks</button>'));
  assert.equal(CE.choose(unknown),null);
  assert.equal(CE.validate(unknown,{candidateID:'c0',action:'accept'}),false);
});

test('TF1 refusal confirmation wins over acceptance and Premium',()=>{
  const s=view(dialog('<p>Vous avez fait le choix de refuser les cookies.</p><button>En savoir plus</button><button>CONFIRMER VOTRE REFUS</button><button>MODIFIER ET TOUT ACCEPTER</button><button>PARAMÉTRER VOS CHOIX</button><a href="/premium">S’ABONNER À PREMIUM</a>'));
  assert.equal(CE.choose(s),null);
  assert.equal(CE.validate(s,assessed('c1'),new Set(),true),true);
  assert.equal(CE.validate(s,{candidateID:'c2',action:'reject'},new Set(),true),false);
  for(const label of ['Confirmer votre refus et vous abonner','Confirmer votre refus et tout accepter','Ne pas confirmer votre refus']){
    const misleading=view(dialog(`<button>${label}</button><button>Modifier et tout accepter</button>`));
    assert.equal(CE.validate(misleading,{candidateID:'c0',action:'reject'},new Set(),true),false);
  }
});

test('model decisions use effects rather than language-specific labels',()=>{
  for(const label of ['ABLEHNUNG BESTÄTIGEN','Conferma il rifiuto','拒否を確認','رفض ملفات تعريف الارتباط']){
    const s=view(`<section role="dialog"><h2>Datenschutz</h2><button>${label}</button></section>`);
    assert.equal(CE.validate(s,assessed('c0'),new Set(),true),true);
    assert.equal(CE.validate(s,assessed('c0','reject',{requiresPaymentOrAccount:true}),new Set(),true),false);
    assert.equal(CE.validate(s,assessed('c0','reject',{effect:'acceptToContinue'}),new Set(),true),false);
    assert.equal(CE.validate(s,assessed('c0','accept',{alternatives:'rejectionAvailable'}),new Set(),true),false);
  }
});

test('discovers Sourcepoint consent frames without dialog roles or English labels',()=>{
  const s=view('<div class="message-container"><div id="notice" class="message type-modal"><h2>Datenschutzeinstellungen</h2><button>Alle ablehnen</button><button>Zustimmen</button></div></div>');
  assert.equal(s?.provider,'Sourcepoint');
  assert.equal(s.candidates.length,2);
});

test('model cannot click explanatory links inside consent dialogs',()=>{
  const s=view(dialog('<a href="#">Speichern von oder Zugriff auf Informationen auf einem Endgerät</a><button>Einstellungen</button>'));
  assert.equal(CE.validate(s,assessed('c0'),new Set(),true),false);
  assert.equal(CE.validate(s,assessed('c1','settings'),new Set(),true),true);
});

test('keeps visible button text alongside an incomplete accessibility label',()=>{
  const s=view(dialog('<button aria-label="TOUT">Tout accepter</button><button>Refuser et payer 5,99€/mois</button>'));
  assert.equal(s.candidates[0].label,'TOUT');
  assert.equal(s.candidates[0].text,'Tout accepter');
  assert.equal(CE.choose(s),null);
});

test('selected refusal radios stop being actionable and the model can save a complete selection',()=>{
  const s=view(dialog('<div role="radiogroup"><button role="radio" aria-checked="true">Refuser</button><button role="radio" aria-checked="false">Accepter</button></div><button>Enregistrer vos préférences et fermer</button>'));
  assert.equal(CE.choose(s),null);
  const decision=assessed('c2','save');
  assert.equal(CE.validate(s,decision,new Set(),true),true);
  assert.equal(CE.validate(s,{candidateID:'c2',action:'save'},new Set(),true),false);
  s.candidates[0].state=false;
  assert.equal(CE.validate(s,decision,new Set(),true),false);
});
test('DOM fallback preserves state and labels without scripts, URLs, or input values',()=>{
  const s=view(dialog('<script>secret()</script><input value="private"><div role="radiogroup"><button role="radio" aria-checked="true">Refuser</button><button role="radio" aria-checked="false">Accepter</button></div><button aria-label="TOUT">Tout accepter</button><a href="https://private/path">Info</a>'));
  const html=CE.domSnapshot(s);
  assert.match(html,/role="radio"/);assert.match(html,/aria-checked="true"/);
  assert.match(html,/data-ce-id="c2"/);assert.match(html,/aria-label="TOUT"/);assert.match(html,/Tout accepter/);
  assert(!/secret|https:|private|<script|value=/.test(html));
  assert(html.length<=3000);
});

test('currency-bearing controls are blocked even if a model misclassifies them as rejection',()=>{
  for(const text of ['Refuser et payer 5,99€','Ablehnen und 5$ bezahlen','拒否して￥500を支払う']){
    const s=view(dialog(`<button>${text}</button><button>Settings</button>`));
    assert.equal(CE.validate(s,assessed('c0'),new Set(),true),false);
    assert(!CE.modelCandidates(s).some(c=>c.id==='c0'));
  }
});

test('active Didomi preferences take precedence over the underlying notice',()=>{
  const s=view('<div id="didomi-host"><div class="didomi-popup-container"><h2>Preferences</h2><button>Save preferences</button></div><button>Reject all</button><button>Accept all</button></div>');
  assert.equal(s.root.className,'didomi-popup-container');
  assert.deepEqual(s.candidates.map(c=>c.label),['Save preferences']);
});
test('a radio option cannot be clicked as an open-settings action',()=>{
  const s=view(dialog('<button role="radio" aria-checked="false">Accepter</button>'));
  assert.equal(CE.validate(s,assessed('c0','settings'),new Set(),true),false);
});

test('control IDs survive unrelated hidden controls appearing before them',()=>{
  const w=page(dialog('<button>Reject all</button><button>Save preferences</button>'));
  const options={visible:el=>!el.hidden&&!el.closest('[hidden]')};
  const before=CE.inspect(w.document,options),id=before.candidates[1].id,el=before.candidates[1].element;
  const hidden=w.document.createElement('button');hidden.hidden=true;hidden.textContent='Hidden';w.document.querySelector('section').prepend(hidden);
  const after=CE.inspect(w.document,options);
  assert.equal(after.candidates.find(c=>c.element===el).id,id);
  assert.notEqual(after.candidates[0].id,before.candidates[0].id);
});
test('cookie consent takes priority over an unrelated location dialog and excluded roots stay ignored',()=>{
 const w=page('<section role="dialog" id="location"><h2>Select your country</h2><button>Close</button><button>Visit</button></section><section role="dialog" id="notice"><h2>À propos des cookies sur ce site</h2><button>Refuser tous les cookies</button><button>Tout autoriser</button></section>');
 const visible=()=>true,ignoredRoots=new WeakSet();
 assert.equal(CE.inspect(w.document,{visible}).root.id,'notice');
 ignoredRoots.add(w.document.querySelector('#location'));
 w.document.querySelector('#notice').remove();
 assert.equal(CE.inspect(w.document,{visible,ignoredRoots}),null);
});
test('discovers nested open shadow consent and resolves labels inside the same tree',()=>{
 const w=page('<h2 id="refuse-label">Accept all</h2><div id="widget"></div>');
 const outer=w.document.querySelector('#widget').attachShadow({mode:'open'});outer.innerHTML='<div id="nested"></div>';
 const inner=outer.querySelector('#nested').attachShadow({mode:'open'});inner.innerHTML='<section role="dialog"><h2>Cookie preferences</h2><span id="refuse-label">Continuer sans accepter</span><button aria-labelledby="refuse-label"></button><button>Accept all</button></section>';
 const s=CE.inspect(w.document,{visible:()=>true});assert(s,'Consent inside an open shadow tree must be discoverable');
 assert.equal(CE.choose(s).candidate.label,'Continuer sans accepter');assert.equal(CE.choose(s).action,'reject');
 assert.match(CE.domSnapshot(s),/Continuer sans accepter/);
});
test('shadow visibility includes hidden, inert and aria-hidden ancestors across the host',()=>{
 const w=page('<div id="host"></div>');const host=w.document.querySelector('#host');
 const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<section role="dialog"><h2>Cookie preferences</h2><button>Reject all</button></section>';
 for(const el of [...w.document.querySelectorAll('*'),...shadow.querySelectorAll('*')])el.style.opacity='1';
 const button=shadow.querySelector('button');button.getClientRects=()=>[{}];
 assert.equal(CE.visible(button),true);
 for(const [key,value] of [['hidden',''],['inert',''],['aria-hidden','true'],['style','display:none'],['style','opacity:0']]){
  host.setAttribute(key,value);assert.equal(CE.visible(button),false,key+'='+value);host.removeAttribute(key);host.style.opacity='1';
 }
});
test('discovers a floating consent panel without provider IDs, dialog roles or English text',()=>{
 const w=page('<nav style="position:fixed"><button>Produkte</button></nav><div style="position:fixed;bottom:0"><p>Ihre Datenschutzeinstellungen</p><button>Nur erforderliche zulassen</button><button>Alle akzeptieren</button></div>');
 const s=CE.inspect(w.document,{visible:()=>true});assert(s,'The model must receive unknown floating panels');assert.equal(s.root.tagName,'DIV');assert.equal(s.rulesEligible,false);assert.equal(CE.choose(s),null);
 assert.deepEqual(CE.modelCandidates(s).map(c=>c.label),['Nur erforderliche zulassen','Alle akzeptieren']);
});
