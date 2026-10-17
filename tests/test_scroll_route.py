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
      html, body { margin: 0; }
      section { min-height: 1100px; padding: 80px; box-sizing: border-box; }
      section:nth-child(odd) { background: #f3f0ff; }
      h2 { display: inline-block; margin: 0; padding: 12px; }
    </style>
  </head>
  <body>
    <main>
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
    name: 'route-test',
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
        page.evaluate(
            """
            () => {
              window.__renderedSpiderScale = 1;
              const nativeScale = CanvasRenderingContext2D.prototype.scale;
              CanvasRenderingContext2D.prototype.scale = function(x, y) {
                window.__renderedSpiderScale = x;
                return nativeScale.call(this, x, y);
              };
            }
            """
        )
        page.evaluate(ENGINE)
        page.evaluate(ADAPTER)
        page.evaluate("window.Spider.extract(window.TestAdapter, 3)")
        page.locator("#__spider-speed").evaluate(
            "element => { element.value = '3'; element.dispatchEvent(new Event('input')); }"
        )
        page.evaluate("window.scrollTo(0, 2400)")
        page.evaluate(
            """
            () => {
              window.__scrollCalls = [];
              window.__statusLog = [];
              window.__inspectionFrames = [];
              const nativeScrollTo = window.scrollTo.bind(window);
              window.scrollTo = options => {
                const top = typeof options === 'object' ? Number(options.top) : Number(arguments[1]);
                window.__scrollCalls.push(top);
                nativeScrollTo(options);
              };
              const status = document.querySelector('#__spider-status');
              new MutationObserver(() => {
                const text = status.textContent;
                window.__statusLog.push(text);
                if (!text.startsWith('Inspecting')) return;
                const label = text.match(/“([^”]+)”/)?.[1];
                const id = `${label?.toLowerCase().split(' ')[0]}-target`;
                const rect = document.getElementById(id)?.getBoundingClientRect();
                if (rect) window.__inspectionFrames.push({ label, top: rect.top, bottom: rect.bottom });
              })
                .observe(status, { childList: true, subtree: true });
            }
            """
        )

        summary = page.evaluate("window.Spider.animate(30000, 3)")
        evidence = page.evaluate(
            """
            () => ({
              scrolls: window.__scrollCalls,
              inspected: window.__statusLog
                .filter(text => text.startsWith('Inspecting'))
                .map(text => text.match(/“([^”]+)”/)?.[1]),
              inspectionFrames: window.__inspectionFrames,
              finalScroll: window.scrollY,
              pageEnd: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight,
              finalStatus: document.querySelector('#__spider-status').textContent,
              finalState: document.querySelector('#__spider-status').dataset.state,
              renderedSpiderScale: window.__renderedSpiderScale,
              controlsHidden: document.querySelector('#__spider-controls').hidden,
              controlsDisplay: getComputedStyle(document.querySelector('#__spider-controls')).display,
              closeButton: Boolean(document.querySelector('#__spider-close')),
            })
            """
        )
        close_button = page.locator("#__spider-close")
        close_box = close_button.bounding_box()
        normal_close_background = close_button.evaluate(
            "element => getComputedStyle(element).backgroundImage"
        )
        close_button.hover()
        page.wait_for_timeout(200)
        hover_close_background = close_button.evaluate(
            "element => getComputedStyle(element).backgroundImage"
        )
        evidence["closeButtonUi"] = {
            "width": round(close_box["width"]),
            "height": round(close_box["height"]),
            "title": close_button.get_attribute("title"),
            "hoverChanged": normal_close_background != hover_close_background,
        }
        close_button.click()
        evidence["closed"] = page.locator("#__spider-ui, #__spider").count() == 0
        browser.close()

    first_top = next(index for index, value in enumerate(evidence["scrolls"]) if value <= 1)
    downward_route = evidence["scrolls"][first_top:]
    reversals = [
        (previous, current)
        for previous, current in zip(downward_route, downward_route[1:])
        if current + 1.5 < previous
    ]

    assert summary == {"animated": 3, "skipped": 0, "total": 3}
    assert evidence["inspected"] == ["Top target", "Middle target", "Bottom target"]
    assert all(
        frame["top"] >= 0 and frame["bottom"] <= 800
        for frame in evidence["inspectionFrames"]
    ), f"A target was inspected outside the viewport: {evidence['inspectionFrames']}"
    assert not reversals, f"Detected reverse scrolling after reaching the top: {reversals[:5]}"
    assert abs(evidence["finalScroll"] - evidence["pageEnd"]) <= 1
    assert evidence["finalState"] == "complete"
    assert evidence["finalStatus"] == "Done — resting in a tiny web"
    assert abs(evidence["renderedSpiderScale"] - 0.75) < 0.001
    assert evidence["controlsHidden"]
    assert evidence["controlsDisplay"] == "none"
    assert evidence["closeButton"]
    assert evidence["closeButtonUi"] == {
        "width": 34,
        "height": 34,
        "title": "Close Keyword Spider",
        "hoverChanged": True,
    }, evidence["closeButtonUi"]
    assert evidence["closed"]
    print(json.dumps({"summary": summary, "evidence": evidence | {"scrolls": {
        "count": len(evidence["scrolls"]),
        "start": round(evidence["scrolls"][0]),
        "minimum": round(min(evidence["scrolls"])),
        "end": round(evidence["scrolls"][-1]),
        "reversalsAfterTop": len(reversals),
    }}}, indent=2))


if __name__ == "__main__":
    main()
