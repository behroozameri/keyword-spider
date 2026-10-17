import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
ENGINE = (ROOT / "engine" / "spider.js").read_text(encoding="utf-8")
ADAPTERS = (ROOT / "extension" / "adapters.js").read_text(encoding="utf-8")

PAGE = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>AI Infrastructure Jobs | LinkedIn</title>
    <style>
      body { margin: 0; font: 16px/1.4 system-ui, sans-serif; }
      main { width: 620px; padding: 24px; }
      .job-card-container {
        position: relative;
        min-height: 220px;
        margin-bottom: 24px;
        padding: 24px;
        border: 1px solid #ddd;
      }
      /* This intentionally mimics an aggressive host-page rule. */
      .job-card-container > span { position: absolute; inset: 0; display: block; }
      .visually-hidden {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
      }
    </style>
  </head>
  <body>
    <main>
      <article class="job-card-container">
        <span class="visually-hidden">ml</span>
        AI Infrastructure Engineer
        <h3>AI Infrastructure Engineer</h3>
        <p>Mission.dev · Canada (Remote)</p>
        <p>Build reliable machine learning infrastructure and model deployment systems.</p>
        <p>You'd be a top applicant</p>
        <p>Promoted · 1 day ago · 144.2K CAD/yr</p>
      </article>
      <article class="job-card-container">
        <h3>Senior Machine Learning Engineer</h3>
        <p>Design scalable model serving, evaluation, and production workflows.</p>
        <p>Actively reviewing applicants · Easy Apply · Promoted</p>
      </article>
    </main>
  </body>
</html>
"""


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1100, "height": 800})
        page.route("https://www.linkedin.com/**", lambda route: route.fulfill(
            status=200,
            content_type="text/html",
            body=PAGE,
        ))
        page.goto("https://www.linkedin.com/jobs/search/")
        page.evaluate(ENGINE)
        page.evaluate(ADAPTERS)
        start_result = page.evaluate(
            "window.SpiderExtension.start({ max: 40, top: 0, timeout: 5000 })"
        )
        values = page.locator(".__spider-value").all_text_contents()
        highlights = page.locator("[data-spider-keyword]").evaluate_all(
            """
            elements => elements.map(element => {
              const rect = element.getBoundingClientRect();
              return { text: element.textContent, width: rect.width, height: rect.height };
            })
            """
        )
        final_status = page.locator("#__spider-status").text_content()
        controls_hidden = page.locator("#__spider-controls").evaluate(
            "element => element.hidden && getComputedStyle(element).display === 'none'"
        )
        browser.close()

    normalized = [value.lower() for value in values]
    rejected_fragments = [
        "promoted", "applicant", "easy apply", "actively reviewing", "cad", "ml",
    ]

    assert start_result["ok"]
    assert start_result["adapter"] == "linkedin-jobs"
    assert any("ai infrastructure" in value for value in normalized)
    assert any("machine learning" in value for value in normalized)
    assert all(
        fragment != value and fragment not in value
        for fragment in rejected_fragments
        for value in normalized
    )
    assert highlights
    assert all(item["height"] <= 96 for item in highlights), highlights
    assert all(item["width"] < 1045 for item in highlights), highlights
    assert final_status == "Page scan complete: 0 inspected, 0 skipped"
    assert controls_hidden
    print(json.dumps({
        "adapter": start_result["adapter"],
        "resultCount": len(values),
        "keywords": values,
        "maxHighlightHeight": max(round(item["height"], 2) for item in highlights),
        "finalStatus": final_status,
        "controlsHidden": controls_hidden,
        "excluded": rejected_fragments,
    }, indent=2))


if __name__ == "__main__":
    main()
