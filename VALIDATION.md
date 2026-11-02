# Validation

Checked on November 2, 2026, on the actual Mac running macOS 27.2 and Xcode 27.1.

## Native and Safari

- Apple Foundation Models reports `available` on this Mac.
- A real Safari popup → background script → native Swift extension → on-device inference round trip returned the rejection control.
- The bridge also worked after quitting the companion app.
- After switching to label-constrained guided generation, the signed app automatically handled an unfamiliar “Use essential cookies only” banner in actual Safari. The popup recorded an unverified rejection request.
- Actual Safari fixtures handled direct rejection, French rejection, delayed banners, and settings-only rejection with marketing, analytics, and legitimate interest switched off before saving.
- Safari’s extension settings confirmed access on all websites.
- The generated cookie icon was inspected in the native app. The popup was inspected in Safari.
- The delivered Debug app and embedded extension are Apple Development signed; Safari showed the extension enabled on all websites while **Allow unsigned extensions** was **off**. A separate Release app and embedded extension are Developer ID signed. Both use the hardened runtime and explicit sandbox entitlements. `codesign --verify --deep --strict` passes. No debugging or network-client entitlement is included in the release signature.
- FoundationModels is weak linked, preserving the rule-only path on older supported macOS versions. Older systems were not physically tested.

## Automated checks

`npm test` covers policy and background behavior: English/French controls, settings-only flows, legitimate-interest choices, unsafe and misleading controls, model-output validation, persisted consent evidence, subscription-wall acceptance, rejection priority, per-site pause inheritance, private-window history exclusion, concurrent storage writes, bounded history, and updating a click record with stronger evidence.

`npm run test:browser` runs the actual content engine in WebKit with a mocked WebExtension transport. It covers direct/settings/French/delayed/model paths, unavailable and busy models, misleading controls, ignored clicks, acceptance versus subscription, pause/resume, navigation during inference, explicit retry, cross-origin frames, and frames removed immediately after a consent click. These tests do not certify Safari’s transport by themselves; the separate real Safari bridge check does.

`./scripts/test-native.sh` exercises the real Foundation Models API, input bounds, English, French, German, and Italian classification, including refusal confirmations and paid-subscription traps, when the model is available.

## Libération

The real Safari banner offered “Refuser et s’abonner pour 1€” and “Accepter et continuer.” Safari’s website-data manager was used to remove the `liberation.fr` entry, and showed **No Saved Website Data** afterward.

A separate fresh WebKit visit found the live dialog in a `consent.liberation.fr` frame. The shipped engine selected `accept` for “Accepter et continuer,” without selecting the subscription or sign-in controls. A subsequent automated live visit encountered the site’s CAPTCHA protection, so a complete fresh live acceptance-and-persistence run is not claimed. No CAPTCHA was bypassed.

Controlled tests reproduce the same controls and frame teardown. Clicks are recorded immediately, before a consent frame can disappear; later verification updates the same record. A closed frame or vanished banner is never treated as verified rejection.

## Limits

- Real-site coverage is not exhaustive. Bundled provider roots currently cover OneTrust, Cookiebot, Didomi, TrustArc, and Sourcepoint, with conservative generic detection and a subscribe-or-consent fallback. This is not a certificate for every version of those providers.
- Verified rejection currently requires fresh Cookiebot category flags. Other flows remain “Requested” unless stronger evidence is added.
- Unavailable-model behavior was simulated in browser tests; Apple Intelligence was not disabled system-wide for testing.
- Closed shadow roots, frames without Safari website permission, unsupported language/control labels, and settings that cannot be interpreted safely remain manual.
- The 0.1.1 universal distribution build passed Apple notarization and stapler validation. Gatekeeper reports Notarized Developer ID. Local development builds also remain available. App Store distribution is managed through the separate store listing.

## Live multilingual browser checks

Fresh isolated WebKit profiles ran the shipped content engine and the real Swift Foundation Models implementation. The extension was also checked in actual Safari after clearing test website data.

| Site | Language | Observed behavior |
|---|---|---|
| M6 | French | Opened settings, selected refusal, and saved. Completed in WebKit and Safari. |
| TF1 | French | Rejected, then confirmed the refusal. Completed in WebKit and Safari. |
| ZDF | German | Model chose Ablehnen. Completed in WebKit and Safari. |
| Lidl | German | Model chose ABLEHNEN. Completed in WebKit and Safari. |
| RAI | Italian | Model chose Continua senza accettare. Completed in WebKit and Safari. |
| Euronics | Italian | Model chose Continua senza accettare. Completed in WebKit and Safari. |

In fresh WebKit profiles all five banners remained dismissed after reload with automation paused. Safari recorded rejection requests, without claiming stored category verification. The TF1 Safari retest followed a targeted website-data removal confirmed by No Saved Website Data, and ran with the companion app quit.

Libération's latest WebKit visit did not expose a consent dialog. Its Safari visit passed an automatic device check and loaded the site without a new consent outcome. Its acceptance-and-persistence flow remains unverified.

Heise and Stern were also tried. Their unfamiliar settings remain Needs attention when the semantic assessments disagree. Explanatory links are excluded from model actions. ZEIT blocked automated access; several other candidates did not display consent prompts in the visits tested. These are not passes.

The AI path validates live DOM identity, visibility, action type, and semantic effects without an English/French label allowlist. Disagreement leaves the banner alone. Model classification is probabilistic; these checks do not establish support for every language or publisher.

Current automated coverage: 37 policy/background tests and 25 controlled WebKit scenarios, plus real native model probes. A replayable live-site probe is available as scripts/test-live.sh.

## DOM-guided fallback

When rules cannot choose another action, the on-device model receives a compact, sanitized consent-dialog DOM with stable control IDs, visible text, radio groups, and checked/disabled states. It chooses one next control and action. Code limits eligible controls and permits saving only after the settings have explicit, complete selections. An independent model assessment checks the selected control's effect; close/cancel controls are not save controls. Retries use fresh sessions and remain bounded by the native and content deadlines.

M6 was tested with empty WebKit profiles and in the installed, Developer ID signed and notarized build 4. Safari's website-data manager confirmed **No Saved Website Data** for m6.fr before the visit. Cookie Eater completed the consent flow automatically and recorded **Requested**, preserving the distinction from stored-category verification. The banner stayed absent on reload with Cookie Eater paused, then automatic operation was restored.

The final fresh-profile live regression passed M6, TF1, ZDF, Lidl, RAI, and Euronics, using the real Swift model. All six remained dismissed on reload with automation paused. Native probes also cover a selected-refusal DOM with a misleading close control and a standalone refusal confirmation that cannot be treated as a settings save.

The 0.1.1 distribution (build 5) contains the same Safari-validated consent engine with updated version metadata. Both universal executables, sandbox entitlements, timestamped signatures, notarization, stapling, and Gatekeeper assessment were checked before publication. The release checks passed all 33 policy/background tests and 19 controlled WebKit scenarios.


## ProBikeShop and Nutella

The consent engine prioritizes recognizable consent dialogs over unrelated country-selection modals. The on-device model can also classify an unrelated dialog without clicking it, while observation continues for delayed consent banners. Controlled regressions cover both concurrent dialogs and delayed consent after an unrelated modal.

ProBikeShop completed automatic rejection in actual Safari after targeted website-data removal. The country selector stayed open, and the popup recorded Requested. Fresh WebKit profiles also completed ProBikeShop, ZDF, and RAI, with no remaining consent dialog after reload while automation was paused.

Nutella was checked in the installed build 7 in Safari after removing nutella.com and nutella.fr website data and confirming No Saved Website Data. Automatic rejection recorded Requested. The settled page stayed free of the banner after reload while Cookie Eater was paused, and automatic operation was restored. A fresh WebKit profile selected REFUSER and retained the choice on paused reload. No Nutella-specific code change was needed. Neither test claims stored-category verification.

The companion app's privacy and support links were inspected in the installed build. The App Store package for 0.1.1 build 7 passed Apple's package validation and processing; this prepared build has not been submitted for review.

Release 0.1.2 (build 8) uses this Safari-tested implementation with updated version metadata. All 34 policy/background tests and 21 controlled WebKit scenarios passed. Both universal executables passed strict signature verification; Apple notarization, stapling, and Gatekeeper assessment passed.


## Open shadow DOM and Val Thorens

Version 0.2.0 (build 10) discovers consent dialogs in open shadow trees, including nested trees and roots attached after page load. It observes each discovered tree and checks for newly attached roots while waiting for consent. Discovery is bounded to 10,000 elements and 32 document/shadow scopes. Visibility checks include hidden, inert, aria-hidden, and styled ancestors across shadow hosts; accessible labels resolve within their own tree. Closed shadow roots remain inaccessible.

All 37 policy/background tests and 25 controlled WebKit scenarios passed. New regressions cover a banner inserted after 32 seconds into an existing shadow root, a root attached after load, nested shadow trees using model interpretation, shadow-local labels, and hidden shadow hosts.

Safari's website-data manager confirmed No Saved Website Data for valthorens.com before the live visit. The installed, Developer ID signed and notarized 0.2.0 build automatically handled the Axeptio banner in its open shadow tree and recorded Requested. This is not stored-category verification. The initial fresh headless WebKit probes did not surface the banner, including a longer visit with scrolling; those visits are not counted as live-site passes.


Les 3 Vallées exposed a role-less floating consent panel. Bounded discovery now considers up to 20 floating panels reached from the first 200 buttons, excluding navigation and forms. The on-device model classifies unfamiliar panels and their controls; no publisher-specific selector or translated click phrase was added. A German fixture exercises this path without provider IDs, a dialog role, or English text.

Fresh WebKit profiles using the real Swift model completed Les 3 Vallées, M6 and ProBikeShop, with no remaining banner after reload while automation was paused. Actual Safari also automatically handled Les 3 Vallées after targeted website-data removal confirmed No Saved Website Data, recording Requested.

Val Thorens stayed clear for 84 seconds after a Safari reload with Cookie Eater paused. These outcomes remain unverified rejection requests rather than verified stored-category results.

Les 3 Vallées also stayed clear for 62 seconds on a Safari reload with automation paused. Automatic operation was restored after testing. The final 0.2.0 build 10 passed universal-binary, strict signature, notarization, stapling, and Gatekeeper checks.
