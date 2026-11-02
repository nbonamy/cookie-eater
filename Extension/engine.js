/* Cookie Eater's DOM-only policy. No page-provided code or model output is executed. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CookieEater = api;
})(globalThis, () => {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g,' ').trim().replace(/[.!:]+$/,'');
  const providers = [
    ['OneTrust','#onetrust-pc-sdk, #onetrust-banner-sdk'],
    ['Cookiebot','#CybotCookiebotDialog'],
    ['Didomi','#didomi-host'],
    ['TrustArc','#truste-consent-track, #trustarc-consent'],
    ['Sourcepoint','.message-container #notice.message, #sp_message_container'],
  ];
  const direct = /^(reject all( cookies)?|reject( optional| non-essential)( cookies)?|decline( all| optional)?( cookies)?|deny all( cookies)?|only (necessary|essential)( cookies)?|(necessary|essential)( cookies)? only|tout refuser|refuser( tous les cookies| les cookies optionnels| les cookies facultatifs)?|continuer sans accepter|uniquement les cookies necessaires)$/;
  const accepts = /^(accept all( cookies)?|accept( cookies)? and continue|allow all( cookies)?|i agree|accepter( tous les cookies)?|tout accepter|accepter et continuer)$/;
  const settings = /^(manage( cookie)? (preferences|settings|cookies)|cookie settings|preferences|customi[sz]e( settings)?|settings|parametrer|personnaliser|gerer( mes| les)? (preferences|cookies)|parametres( des cookies)?|choisir mes cookies)$/;
  const saves = /^(save( my)? (preferences|choices|settings)|confirm( my)? (choices|selection)|save and (exit|close)|enregistrer( mes| les)? (choix|preferences)|confirmer( mes| les)? choix|valider( mes| les)? choix)$/;
  const tabs = /^(legitimate interest|interet(s)? legitime(s)?|vendors|partners|partenaires|purposes|finalites|consent(ement)?|preferences)$/;
  const essential = /\b(necessary|essential|strictly necessary|necessaire|necessaires|essentiel|essentiels|obligatoire|required|security)\b/;
  const optional = /\b(marketing|analytics|analytique|statistic|statistics|statistiques|advertising|advertisement|advertisements|publicite|publicitaires|personalization|personnalisation|preferences|preference|performance|functional|fonctionnels|fonctionnalite|social media|legitimate interest|interet legitime|interets legitimes|measurement|mesure)\b/;
  const forbidden = /\b(accept|agree|allow all|subscribe|subscription|pay|purchase|sign in|log in|buy|accepter|abonner|payer|acheter)\b/;
  const visible = el => {
    if (!el.isConnected || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const w = el.ownerDocument.defaultView;
    for(let p=el;p && p.nodeType===1;p=p.parentElement) {
      const s=w.getComputedStyle(p);
      if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0) return false;
    }
    return el.getClientRects().length > 0;
  };
  function label(el) {
    const doc=el.ownerDocument;
    const labelled=(el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>doc.getElementById(id)?.textContent||'').join(' ').trim();
    return (el.getAttribute('aria-label') || labelled || (el.labels && [...el.labels].map(l=>l.textContent).join(' ')) || el.textContent || el.value || '').trim().slice(0,180);
  }
  function inspect(doc, options={}) {
    const isVisible=options.visible || visible;
    const roots=[];
    for (const [provider,selector] of providers) for(const el of doc.querySelectorAll(selector)) roots.push({el,provider});
    for(const el of doc.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog, [id*="cookie" i], [id*="consent" i], [class*="cookie-banner" i], [class*="consent-banner" i]')) {
      if(!roots.some(r=>r.el===el)) roots.push({el,provider:'Generic'});
      if(roots.length>=40) break;
    }
    // Some publishers render a custom subscribe-or-consent layer without dialog semantics.
    for(const button of [...doc.querySelectorAll('button, [role="button"]')].slice(0,200)) {
      if(!/^(refuser|reject|decline).*\b(abonner|subscribe|subscription)/.test(normalize(label(button))) || !isVisible(button)) continue;
      for(let el=button.parentElement,depth=0;el && el!==doc.body && depth<6;el=el.parentElement,depth++) {
        const text=el.innerText||el.textContent||'';
        if(text.length>10000) break;
        if(/cookies/i.test(text) && [...el.querySelectorAll('button, [role="button"]')].some(b=>/^(accepter|accept)/.test(normalize(label(b))))) {
          roots.unshift({el,provider:'Generic'});break;
        }
      }
    }
    for(const {el,provider} of roots) {
      if(el===doc.body || el===doc.documentElement || !isVisible(el)) continue;
      const text=(el.innerText||el.textContent||'').trim();
      if(!text || text.length>18000) continue;
      const controls=[...el.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="checkbox"], [role="button"], [role="switch"], [role="checkbox"], [role="tab"], a[href]')];
      if(!controls.length || controls.length>100) continue;
      const candidates=controls.map((element,i)=>{
        const toggle=element.matches('input[type="checkbox"], [role="switch"], [role="checkbox"]');
        const state=element.matches('input') ? (element.indeterminate ? 'mixed' : element.checked) : element.getAttribute('aria-checked')==='mixed' ? 'mixed' : element.getAttribute('aria-checked')==='true' ? true : element.getAttribute('aria-checked')==='false' ? false : null;
        const text=label(element);
        return {id:`c${i}`,element,label:text,normalized:normalize(text),toggle,state,visible:isVisible(element),disabled:!!element.disabled || element.getAttribute('aria-disabled')==='true'};
      });
      if(candidates.some(c=>c.visible)) {
        const wall=/[€$£]|\b(payant|paid|subscription|abonnement)\b/i.test(text)&&candidates.some(c=>c.visible && /^(refuser|reject|decline).*\b(abonner|subscribe|subscription)/.test(c.normalized));
        const freeChoice=candidates.some(c=>c.visible && !c.disabled && (direct.test(c.normalized)||settings.test(c.normalized)));
        return {root:el,provider,rulesEligible:provider!=='Generic'||/\b(cookie|cookies|traceurs|consent|consentement)\b/i.test(text),text:text.slice(0,2000),candidates,isVisible,cookieWall:wall&&!freeChoice,onlyAcceptance:candidates.some(c=>c.visible&&!c.disabled&&accepts.test(c.normalized))&&candidates.filter(c=>c.visible&&!c.disabled).every(c=>!c.toggle&&(accepts.test(c.normalized)||(c.element.tagName==='A'&&/^(privacy policy|cookie policy|politique de confidentialite|politique des cookies)$/.test(c.normalized))))};
      }
    }
    return null;
  }
  function usable(c) {
    if(!c || !c.visible || c.disabled || !c.element.isConnected || !c.label) return false;
    const a=c.element.closest('a[href]');
    if(a && !['','#'].includes(a.getAttribute('href'))) return false;
    if(c.element.matches('input[type="submit"], button[type="submit"]') || (c.element.tagName==='BUTTON' && c.element.closest('form') && !c.element.hasAttribute('type'))) return false;
    return true;
  }
  function modelCandidates(s) {
    return s.candidates.filter(c=>usable(c) && c.element.matches('button, input, [role="button"], [role="switch"], [role="checkbox"], [role="tab"]'));
  }
  function readyToSave(s, visited) {
    const toggles=s.candidates.filter(c=>c.toggle);
    if(!toggles.length) return false;
    if(s.candidates.some(c=>usable(c)&&!c.toggle&&c.element.matches('[role="tab"]')&&tabs.test(c.normalized)&&!visited.has(c.normalized))) return false;
    return toggles.every(c=> essential.test(c.normalized) ? (c.disabled || c.state===true) : c.visible && optional.test(c.normalized) && c.state===false);
  }
  function validate(s, decision, visited=new Set(), semantic=false) {
    if(!s || !decision) return false;
    const c=s.candidates.find(c=>c.id===decision.candidateID);
    if(!usable(c) || !s.root.contains(c.element)) return false;
    // The model owns language and meaning; code validates the bounded action and live DOM.
    if(semantic) {
      if(!modelCandidates(s).includes(c)) return false;
      const effects={reject:'rejectOptionalCookies',settings:'openConsentSettings',disable:'disableOptionalPurpose',save:'saveNecessaryOnly',accept:'acceptToContinue'};
      if(decision.requiresPaymentOrAccount!==false || effects[decision.action]!==decision.effect) return false;
      if(c.toggle) return decision.action==='disable' && c.state===true;
      if(decision.action==='disable') return false;
      if(decision.action==='save') return s.candidates.some(x=>x.toggle) && s.candidates.filter(x=>x.toggle&&!x.disabled).every(x=>x.visible&&x.state===false);
      if(decision.action==='accept') return ['acceptanceOnly','subscriptionOrAcceptance'].includes(decision.alternatives);
      return ['reject','settings'].includes(decision.action);
    }
    const n=c.normalized;
    if(decision.action==='accept') return (s.cookieWall||s.onlyAcceptance)&&accepts.test(n);
    if(c.toggle) return decision.action==='disable' && !essential.test(n) && optional.test(n) && c.state===true;
    if(decision.action==='reject' && direct.test(n)) return true;
    if(forbidden.test(n)) return false;
    switch(decision.action) {
      case 'reject': return direct.test(n);
      case 'settings': return settings.test(n);
      case 'tab': return c.element.matches('[role="tab"]') && tabs.test(n) && !visited.has(n);
      case 'save': return saves.test(n) && readyToSave(s,visited);
      default: return false;
    }
  }
  function choose(s, visited=new Set()) {
    if(!s || !s.rulesEligible) return null;
    for(const action of ['reject','disable','tab','save','settings','accept']) {
      for(const candidate of s.candidates) if(validate(s,{candidateID:candidate.id,action},visited)) return {action,candidate};
    }
    return null;
  }
  function cookieValue(cookies,name) {
    const value=cookies.split(/;\s*/).find(c=>c.startsWith(name+'='))?.slice(name.length+1);
    try { return decodeURIComponent(value || ''); } catch { return ''; }
  }
  function evidence(before,after,dismissed,provider='Cookiebot') {
    if(!dismissed) return {status:'needsAttention',evidence:'bannerStillVisible'};
    const prior=cookieValue(before,'CookieConsent'), current=cookieValue(after,'CookieConsent');
    // Parse only booleans from Cookiebot's stored category flags, never eval its object syntax.
    if(provider==='Cookiebot' && current && prior!==current) {
      try {
        // Cookiebot uses a small JSON-like object. Normalize syntax and parse data only.
        const object=JSON.parse(current.replace(/([{,]\s*)([a-zA-Z][a-zA-Z0-9]*)(\s*:)/g,'$1"$2"$3').replace(/'([^'\\]*)'/g,(_,value)=>JSON.stringify(value)));
        const keys=['necessary','preferences','statistics','marketing','method'];
        const unique=keys.every(key=>(current.match(new RegExp(`["']?${key}["']?\\s*:`, 'g'))||[]).length===1);
        if(unique && object.necessary===true && object.preferences===false && object.statistics===false && object.marketing===false && object.method==='explicit') {
          return {status:'verified',evidence:'cookiebotOptionalCategoriesOff'};
        }
      } catch { /* Unrecognized storage is never proof of rejection. */ }
    }
    return {status:'submitted',evidence:'bannerDismissedWithoutStoredProof'};
  }
  return {normalize,inspect,choose,validate,evidence,visible,readyToSave,modelCandidates};
});
