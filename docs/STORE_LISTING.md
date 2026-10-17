# Store Listing Draft

This document contains publication copy and a checklist for Chrome Web Store and Mozilla Add-ons. Update links after each store listing becomes available.

## Product details

- **Name:** Keyword Spider
- **Category:** Productivity
- **Language:** English
- **Version:** 1.0.0
- **Homepage:** https://github.com/behroozameri/keyword-spider
- **Support:** https://github.com/behroozameri/keyword-spider/issues
- **Privacy policy:** https://github.com/behroozameri/keyword-spider/blob/main/PRIVACY.md

## Short description

A playful spider that finds, ranks, and visits the most important English keyphrases on the current page.

## Detailed description

Keyword Spider turns keyword extraction into a visual journey.

Open a page, select Start Spider, and watch an animated spider travel from the top of the content to the bottom while visiting the strongest English keywords and keyphrases. A ranked results panel displays scores and categories, and the full list can be exported as JSON or CSV.

Keyword Spider works across articles, products, documentation, job pages, profiles, search results, listings, and other content-heavy websites. Its local ranking engine considers titles, headings, emphasis, frequency, metadata, content position, and phrase quality while filtering navigation, ads, cookie notices, forms, and other interface noise.

Features:

- English keyword and one-to-three-word keyphrase extraction
- Automatic primary-content and page-type detection
- Top-to-bottom movement with document and nested-page scrolling
- Pause, resume, and speed controls while the spider is active
- Scores, category colors, and JSON/CSV export
- Playful completion and resting animation
- No account, analytics, advertising, or external service

Privacy is a core feature. All page processing happens locally in the browser. Page content and results are not transmitted, collected, sold, shared, or remotely stored.

## Permission justifications

### activeTab

Keyword Spider uses `activeTab` to access only the page where the user explicitly opens the extension. Access is temporary and begins after a direct user action.

### scripting

Keyword Spider uses `scripting` to inject its bundled extraction, results-panel, and animation code into the active page after the user selects Start Spider. It does not download or execute remote code.

## Single purpose

Keyword Spider identifies and ranks important English keyphrases on the current page and presents those results through an interactive spider animation and exportable results panel.

## Privacy disclosures

- Page text is processed locally to provide the extension's core functionality.
- Page text and extracted results are not transmitted or remotely stored.
- No analytics, tracking, advertising, remote code, or external APIs are used.
- JSON and CSV files are generated only after an explicit export action.

## Required visual assets

- Extension icon: 128 × 128 PNG, already available at `extension/icons/icon-128.png`
- At least one Chrome Web Store screenshot: 1280 × 800 PNG or JPEG
- Chrome small promotional tile: 440 × 280 PNG or JPEG
- Optional Chrome marquee promotional tile: 1400 × 560 PNG or JPEG

Use a synthetic or public demo page for screenshots. Do not include names, profile photos, private messages, account details, or other personal information.

Suggested screenshots:

1. The popup showing the default 200 results and 25 targets.
2. The spider visiting a highlighted keyphrase on a neutral demo article.
3. The ranked results panel with scores and category colors.
4. The completed spider resting in its corner web with export controls visible.

## Pre-submission checklist

- [ ] Run `python scripts/run_tests.py`.
- [ ] Run `python scripts/build_extension.py`.
- [ ] Confirm `manifest.json` is at the root of the ZIP.
- [ ] Confirm the manifest version matches the store version.
- [ ] Test a clean unpacked installation in Chrome and Firefox.
- [ ] Verify the privacy declaration matches `PRIVACY.md`.
- [ ] Verify permission justifications match actual behavior.
- [ ] Capture store images without personal information.
- [ ] Confirm homepage, support, and privacy URLs are public.
- [ ] Create a GitHub release and attach the generated ZIP.
