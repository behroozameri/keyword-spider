# Contributing to Keyword Spider

Thank you for considering a contribution. Keyword Spider is intentionally small, privacy-first, and English-only. Contributions should preserve those properties.

## Before opening an issue

- Search existing issues for the same problem or proposal.
- Confirm the problem occurs with the latest version.
- Remove personal information from screenshots, exports, and sample pages.
- Do not include cookies, authentication tokens, or private page content.

## Development setup

```bash
git clone https://github.com/behroozameri/keyword-spider.git
cd keyword-spider
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python scripts/build_extension.py
```

Load `dist/keyword-spider-unpacked` as an unpacked browser extension.

## Making changes

- Keep source code, comments, documentation, commit messages, and UI copy in English.
- Keep browser permissions to the minimum required by the extension's single purpose.
- Do not add analytics, tracking, remote code, or external content-processing services.
- Prefer the generic adapter over site-specific behavior when a reliable generic rule is possible.
- Keep extraction independent from animation so results remain available if animation fails.
- Add or update a focused test for behavioral changes.
- Do not commit generated profiles, recordings, result files, or `dist/` artifacts.
- Use the synthetic page under `demo/` for public screenshots and recordings.

## Test and build

Run all checks before submitting a pull request:

```bash
python scripts/run_tests.py
python scripts/build_extension.py
```

Then verify that the generated ZIP has `manifest.json` at its root:

```bash
unzip -t dist/keyword-spider-v1.0.0.zip
```

## Pull requests

Keep pull requests focused and explain:

1. What changed.
2. Why the change is useful.
3. How it was tested.
4. Whether permissions or data handling changed.

By contributing, you agree that your contribution will be licensed under the MIT License.
