<p align="center">
  <img src="extension/icons/icon.svg" width="112" height="112" alt="Keyword Spider logo">
</p>

<h1 align="center">Keyword Spider</h1>

<p align="center">
  A playful, privacy-first browser extension that finds the most meaningful English keyphrases on a page and sends an animated spider to visit them.
</p>

<p align="center">
  <a href="https://github.com/behroozameri/keyword-spider/actions/workflows/ci.yml"><img src="https://github.com/behroozameri/keyword-spider/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-7b4ce2.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-5b8def.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/language-English-45d6a8.svg" alt="English only">
</p>

Keyword Spider turns keyword extraction into a small visual experience. It identifies the main content, ranks one-to-three-word keyphrases, highlights the strongest candidates, and moves through the page from top to bottom. When the scan is complete, the spider builds a web in the corner and rests.

All extraction, ranking, animation, and export operations run locally in the browser. Page content is never transmitted to an external service.

## Highlights

- Works on general HTTP and HTTPS pages without requiring a site-specific adapter
- Detects articles, products, documentation, jobs, profiles, search results, and listings
- Generates English one-to-three-word candidates with `Intl.Segmenter`
- Uses RAKE-inspired ranking with title, heading, emphasis, frequency, metadata, position, and content-block signals
- Filters navigation, sidebars, cookie notices, ads, forms, toolbars, and other interface noise
- Includes focused adapters for LinkedIn feeds and job pages
- Scans naturally from the top of the page to the bottom
- Supports document scrolling and nested SPA scroll containers
- Visits only visible targets and avoids reverse-scroll jumps
- Provides pause, resume, speed control, scores, category colors, and JSON/CSV export
- Ends with a playful goodbye and resting animation
- Requests only the `activeTab` and `scripting` permissions
- Includes a Playwright demo runner and automated browser tests

## Install locally

### Chrome, Chromium, Brave, or Edge

1. Clone this repository.
2. Run `python3 scripts/build_extension.py`.
3. Open the browser's extensions page, such as `chrome://extensions`.
4. Enable **Developer mode**.
5. Select **Load unpacked**.
6. Choose `dist/keyword-spider-unpacked`.
7. Pin **Keyword Spider** to the toolbar.

Do not load the repository root. The generated unpacked directory contains only the files required by the browser.

### Firefox

1. Run `python3 scripts/build_extension.py`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose `manifest.json` inside `dist/keyword-spider-unpacked`.

Temporary Firefox installations are removed when Firefox restarts. A permanently installed release must be signed by Mozilla Add-ons.

## Use the extension

1. Open a regular HTTP or HTTPS page.
2. Select the Keyword Spider toolbar icon.
3. Choose the number of ranked results to collect.
4. Choose how many top results the spider should visit.
5. Select **Start Spider**.

The default configuration collects up to **200 results** and visits the **top 25 targets**.

- **Results to collect** controls the maximum number of ranked items shown in the results panel and included in exports.
- **Top results to visit** controls how many of the strongest results receive the full spider animation.

The results panel remains available after the animation and can export the complete ranked list as JSON or CSV.

## How ranking works

Keyword Spider first discovers the most likely primary-content region. It then segments English text, removes stopwords and interface labels, creates one-to-three-word candidates, and combines several ranking signals:

- Presence in the page title and meta description
- Presence in headings
- Bold or emphasized text
- Controlled term frequency
- Position near the beginning of the primary content
- Candidate cohesion and phrase quality
- Optional technical-dictionary relevance

Near-duplicate and heavily overlapping candidates are removed before the final list is displayed.

## Privacy and permissions

The extension requests only two permissions:

- `activeTab` provides temporary access to the page where the user invokes the extension.
- `scripting` injects the bundled extraction and animation code after the user selects **Start Spider**.

Keyword Spider does not use analytics, advertising, remote code, external APIs, or persistent access to browsing activity. See the full [Privacy Policy](PRIVACY.md).

## Build a release package

```bash
python3 scripts/build_extension.py
```

The build is derived from the version in `manifest.json`, validates the archive, prints its SHA-256 checksum, and creates:

```text
dist/keyword-spider-unpacked/
dist/keyword-spider-v1.0.0.zip
```

The ZIP contains `manifest.json` at its root and is suitable for Chrome Web Store and Mozilla Add-ons submission. Build artifacts are intentionally excluded from Git; attach the ZIP to a GitHub Release instead.

Pushing a version tag such as `v1.0.0` runs the complete test suite, builds the matching package, and publishes it as a GitHub Release asset.

## Run the automated checks

Requirements:

- Python 3.10 or newer
- Node.js 18 or newer
- Playwright Chromium

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python scripts/run_tests.py
python scripts/build_extension.py
```

The test suite checks general extraction, the 200-result limit, LinkedIn feed and job filtering, top-to-bottom scrolling, nested scroll containers, completion behavior, cleanup, and popup closing.

## Playwright demo runner

The optional runner opens a page in Chromium, extracts keywords, stores the result locally, and runs the same animation engine used by the extension:

```bash
python run.py "https://example.com" --max 40 --top 12 --keep-open
```

Useful options:

```text
--headless             Run without a visible browser window
--record-video         Save a recording under videos/
--profile-dir PATH     Use a specific persistent browser profile
--navigation-timeout   Set the navigation timeout in seconds
--animation-timeout    Set the animation timeout in seconds
--keep-open            Keep the results panel open after the animation
```

Persistent profiles default to `~/.spider-crawler`, outside the repository. Profiles, recordings, build artifacts, and generated result files are excluded from Git.

## Record a product demo

Create a privacy-safe square MP4 for a social post using the bundled synthetic demo page:

```bash
python scripts/record_demo.py
```

The command records a 1080 × 1080 Chromium session and creates `videos/keyword-spider-linkedin-demo.mp4`. It requires FFmpeg and never includes a real account, private page, or external website.

## Project structure

```text
engine/spider.js            Extraction, results UI, scrolling, and animation engine
extension/                  Popup, browser adapters, styles, and icons
sites/                      Playwright-specific adapters
demo/                       Privacy-safe product demo page
scripts/build_extension.py  Clean extension package builder
scripts/record_demo.py      Square MP4 product-demo recorder
scripts/run_tests.py        Cross-platform test runner
tests/                      Browser integration and popup tests
manifest.json               Chrome and Firefox Manifest V3 configuration
run.py                      Optional Playwright demo runner
```

## Current limitations

- Extraction currently targets English content only.
- Browser-internal pages such as `chrome://` and `about:` cannot be inspected.
- Text inside cross-origin iframes, closed shadow roots, and protected built-in PDF viewers is not accessible.
- Pages that continuously replace their content may produce different results between runs.

## Contributing

Bug reports and focused improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Please report security issues using the process in [SECURITY.md](SECURITY.md).

## License

Keyword Spider is available under the [MIT License](LICENSE).
