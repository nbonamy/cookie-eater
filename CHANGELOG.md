# Changelog

## 0.1.1

- Complete M6's settings flow by selecting refusal and saving the choice.
- Fall back to on-device DOM interpretation when bundled rules cannot continue.
- Handle radio selections and incomplete accessibility labels, and keep control IDs stable as banners update.
- Check action compatibility and selected states before saving; distinguish close controls from refusal confirmation.

## 0.1.0

- Automatic cookie consent handling in Safari on Mac.
- Reject optional cookies first; work through settings and legitimate-interest choices where supported.
- Accept to continue when no free rejection path is available.
- On-device Apple Foundation Models interpretation for unfamiliar, multilingual controls.
- Per-site pause and retry, an AI toggle, and private local outcome history.
- Distinct verified, requested, accepted, and needs-attention outcomes.
- A partially eaten cookie icon. 🍪
