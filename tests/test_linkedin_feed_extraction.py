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
    <title>LinkedIn Feed</title>
  </head>
  <body>
    <main>
      <div class="scaffold-finite-scroll__content">
        <article class="feed-shared-update-v2">
          <p><strong>Machine learning infrastructure</strong> enables reliable model deployment.</p>
          <p>Machine learning infrastructure improves evaluation, deployment, and production reliability.</p>
          <p>gh5-Q-MM</p>
          <button>Like</button><button>Comment</button><button>Repost</button>
        </article>
        <article class="feed-shared-update-v2">
          <p><strong>Open source developer tools</strong> help engineering teams collaborate.</p>
          <p>Open source developer tools make complex workflows easier to maintain.</p>
          <button>Follow</button><button>Show more</button>
        </article>
      </div>
      <aside>
        <h2>LinkedIn News</h2>
        <p><strong>Ambitious teen's unusual job search</strong></p>
      </aside>
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
        page.goto("https://www.linkedin.com/feed/")
        page.evaluate(ENGINE)
        page.evaluate(ADAPTERS)
        start_result = page.evaluate(
            "window.SpiderExtension.start({ max: 40, top: 0, timeout: 5000 })"
        )
        values = page.locator(".__spider-value").all_text_contents()
        browser.close()

    normalized = [value.lower() for value in values]
    rejected_fragments = [
        "ambitious teen", "linkedin news", "like", "comment", "repost", "follow", "gh5-q-mm"
    ]

    assert start_result["ok"]
    assert start_result["adapter"] == "linkedin-feed"
    assert any("machine learning infrastructure" in value for value in normalized)
    assert any("open source developer" in value for value in normalized)
    assert all(
        fragment not in value
        for fragment in rejected_fragments
        for value in normalized
    )
    print(json.dumps({
        "adapter": start_result["adapter"],
        "resultCount": len(values),
        "keywords": values,
        "excluded": rejected_fragments,
    }, indent=2))


if __name__ == "__main__":
    main()
