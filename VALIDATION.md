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
- The 0.1.1 universal distribution build passed Apple notarization and stapler validation. Gatekeeper reports Notarized Developer ID. Local development builds also remain available. The app has not been submitted to the App Store.

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

Current automated coverage: 33 policy/background tests and 19 controlled WebKit scenarios, plus real native model probes. A replayable live-site probe is available as scripts/test-live.sh.

## DOM-guided fallback

When rules cannot choose another action, the on-device model receives a compact, sanitized consent-dialog DOM with stable control IDs, visible text, radio groups, and checked/disabled states. It chooses one next control and action. Code limits eligible controls and permits saving only after the settings have explicit, complete selections. An independent model assessment checks the selected control's effect; close/cancel controls are not save controls. Retries use fresh sessions and remain bounded by the native and content deadlines.

M6 was tested with empty WebKit profiles and in the installed, Developer ID signed and notarized build 4. Safari's website-data manager confirmed **No Saved Website Data** for m6.fr before the visit. Cookie Eater completed the consent flow automatically and recorded **Requested**, preserving the distinction from stored-category verification. The banner stayed absent on reload with Cookie Eater paused, then automatic operation was restored.

The final fresh-profile live regression passed M6, TF1, ZDF, Lidl, RAI, and Euronics, using the real Swift model. All six remained dismissed on reload with automation paused. Native probes also cover a selected-refusal DOM with a misleading close control and a standalone refusal confirmation that cannot be treated as a settings save.

The 0.1.1 distribution (build 5) contains the same Safari-validated consent engine with updated version metadata. Both universal executables, sandbox entitlements, timestamped signatures, notarization, stapling, and Gatekeeper assessment were checked before publication. The release checks passed all 33 policy/background tests and 19 controlled WebKit scenarios.
