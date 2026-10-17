import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
ENGINE = (ROOT / "engine" / "spider.js").read_text(encoding="utf-8")

PAGE = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; }
      #scroll-root { position: absolute; inset: 50px 150px 50px 20px; overflow-y: auto; }
      section { min-height: 1000px; padding: 80px; box-sizing: border-box; }
      section:nth-child(odd) { background: #f3f0ff; }
      h2 { display: inline-block; margin: 0; padding: 12px; }
    </style>
  </head>
  <body>
    <main id="scroll-root">
      <section><h2 id="top-target">Top target</h2></section>
      <section><h2 id="middle-target">Middle target</h2></section>
      <section><h2 id="bottom-target">Bottom target</h2></section>
    </main>
  </body>
</html>
"""

ADAPTER = """
(() => {
  window.TestAdapter = {
    name: 'nested-scroll-test',
    collect() {
      return [
        { el: document.querySelector('#bottom-target'), type: 'keyword', text: 'Bottom target', score: 0.99 },
        { el: document.querySelector('#top-target'), type: 'keyword', text: 'Top target', score: 0.95 },
        { el: document.querySelector('#middle-target'), type: 'keyword', text: 'Middle target', score: 0.90 },
      ];
    },
  };
})();
"""


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1100, "height": 800})
        page.set_content(PAGE)
        page.evaluate(ENGINE)
        page.evaluate(ADAPTER)
        page.evaluate("window.Spider.extract(window.TestAdapter, 3)")
        page.locator("#__spider-speed").evaluate(
            "element => { element.value = '3'; element.dispatchEvent(new Event('input')); }"
        )
        page.evaluate(
            """
            () => {
              const root = document.querySelector('#scroll-root');
              root.scrollTop = 2000;
              window.__scrollCalls = [];
              window.__inspectionFrames = [];
              const nativeScrollTo = root.scrollTo.bind(root);
              root.scrollTo = options => {
                window.__scrollCalls.push(Number(options.top));
                nativeScrollTo(options);
              };
              const status = document.querySelector('#__spider-status');
              new MutationObserver(() => {
                const text = status.textContent;
                if (!text.startsWith('Inspecting')) return;
                const label = text.match(/“([^”]+)”/)?.[1];
                const id = `${label?.toLowerCase().split(' ')[0]}-target`;
                const rect = document.getElementById(id)?.getBoundingClientRect();
                if (rect) window.__inspectionFrames.push({ label, top: rect.top, bottom: rect.bottom });
              }).observe(status, { childList: true, subtree: true });
            }
            """
        )

        summary = page.evaluate("window.Spider.animate(30000, 3)")
        evidence = page.evaluate(
            """
            () => {
              const root = document.querySelector('#scroll-root');
              return {
                scrolls: window.__scrollCalls,
                frames: window.__inspectionFrames,
                finalScroll: root.scrollTop,
                pageEnd: root.scrollHeight - root.clientHeight,
                windowScroll: window.scrollY,
              };
            }
            """
        )
        browser.close()

    first_top = next(index for index, value in enumerate(evidence["scrolls"]) if value <= 1)
    downward_route = evidence["scrolls"][first_top:]
    reversals = [
        (previous, current)
        for previous, current in zip(downward_route, downward_route[1:])
        if current + 1.5 < previous
    ]

    assert summary == {"animated": 3, "skipped": 0, "total": 3}
    assert [frame["label"] for frame in evidence["frames"]] == [
        "Top target", "Middle target", "Bottom target"
    ]
    assert all(50 <= frame["top"] and frame["bottom"] <= 750 for frame in evidence["frames"])
    assert not reversals
    assert abs(evidence["finalScroll"] - evidence["pageEnd"]) <= 1
    assert evidence["windowScroll"] == 0
    print(json.dumps({
        "summary": summary,
        "nestedScroller": {
            "calls": len(evidence["scrolls"]),
            "end": round(evidence["finalScroll"]),
            "pageEnd": round(evidence["pageEnd"]),
            "reversalsAfterTop": len(reversals),
        },
        "inspectionFrames": evidence["frames"],
    }, indent=2))


if __name__ == "__main__":
    main()
