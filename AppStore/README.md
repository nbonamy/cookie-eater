# Mac App Store submission

The store listing is **Cookie Eater for Safari**, under app ID `6829860527`. Cookie Eater is a free, Mac-only Safari extension with manual release after approval.

- Containing app: `com.nbonamy.CookieEater`
- Safari extension: `com.nbonamy.CookieEater.Extension`
- Primary language: English (U.S.)
- Category: Productivity; secondary category: Utilities

The listing copy, URLs, keywords, review notes, and proposed privacy declarations are in this directory. The app includes privacy and support links. Review contact details belong in App Store Connect and are not stored in this repository.

## Distribution build

Use an Xcode account with access to the Apple Developer team, app distribution signing, and installer distribution signing:

```sh
COOKIE_EATER_TEAM_ID='TEAMID' ./scripts/build-app-store.sh
```

The archive and exported installer package are written under `dist/app-store/`, which Git ignores. Xcode manages provisioning. The script exports a package; it does not upload, submit for review, or release the app.

Signing credentials, private keys, team-specific export options, archives, and installer packages must stay outside Git.

## Screenshots

```sh
node AppStore/render-screenshots.cjs
```

The renderer uses the shipped popup HTML, CSS, and JavaScript in WebKit with fictional example domains and activity. It produces opaque 1280 × 800 Mac screenshots, with no personal browsing history. It does not alter the popup UI or invent product controls.

Before review, select the processed build, upload the screenshots and metadata, complete the store questionnaires, verify pricing is free, and choose manual release. Submission for Apple review is a separate action.

Apple references: [Safari extension distribution](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension), [Mac screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [privacy details](https://developer.apple.com/app-store/app-privacy-details/).
