import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
ENGINE = (ROOT / "engine" / "spider.js").read_text(encoding="utf-8")
ADAPTERS = (ROOT / "extension" / "adapters.js").read_text(encoding="utf-8")
GENERIC_SITE = (ROOT / "sites" / "generic.js").read_text(encoding="utf-8")

ARTICLE_PAGE = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Universal Keyword Extraction for Modern Websites</title>
    <meta name="description" content="Universal keyword extraction ranks meaningful topics using content scoring signals.">
  </head>
  <body>
    <nav>Home Pricing Login Search</nav>
    <main>
      <article itemscope itemtype="https://schema.org/Article">
        <header>
          <h1>Universal Keyword Extraction for Modern Websites</h1>
          <p>By Example Author</p>
        </header>
        <p><strong>Universal keyword extraction</strong> finds meaningful topics without depending on a domain.</p>
        <p>Reliable content detection separates primary writing from navigation and unrelated interface labels.</p>
        <h2>Content scoring signals</h2>
        <p>Content scoring signals combine headings, emphasis, repetition, metadata, and document position.</p>
        <p>Semantic content detection improves keyword quality across blogs, news sites, and knowledge bases.</p>
        <aside class="newsletter-panel">Newsletter subscription and sponsored recommendations</aside>
        <button>Subscribe now</button>
        <p data-spider-ignore="author-note">Private author note should remain ignored.</p>
      </article>
    </main>
    <div class="cookie-consent">Accept cookies and review privacy settings</div>
    <footer>Terms Privacy Contact</footer>
  </body>
</html>
"""

PRODUCT_PAGE = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Aurora Noise Cancelling Headphones</title>
    <meta name="description" content="Aurora headphones deliver adaptive noise cancellation and immersive spatial audio.">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Aurora Noise Cancelling Headphones"}
    </script>
  </head>
  <body>
    <header role="banner">Store Menu Account Cart</header>
    <main>
      <section class="content">
        <h1>Aurora Noise Cancelling Headphones</h1>
        <p><strong>Adaptive noise cancellation</strong> responds to changing environments in real time.</p>
        <p>Immersive spatial audio creates a detailed listening experience with balanced sound.</p>
        <h2>Long battery life</h2>
        <p>Long battery life supports extended travel, focused work, and wireless listening.</p>
        <button>Add to cart</button>
      </section>
      <aside id="sidebar-recommendations">Sponsored products and newsletter offers</aside>
    </main>
    <footer>Shipping Checkout Privacy</footer>
  </body>
</html>
"""


def alphabetic_id(index):
    value = index
    letters = []
    while True:
        letters.append(chr(ord("a") + value % 26))
        value //= 26
        if value == 0:
            return "".join(reversed(letters)).rjust(4, "a")


LIMIT_ITEMS = "".join(
    f"<section><h2>Concept {alphabetic_id(index)} discovery</h2>"
    f"<p>Concept {alphabetic_id(index)} discovery explains specialized knowledge patterns. "
    f"Concept {alphabetic_id(index)} discovery supports careful topic analysis.</p></section>"
    for index in range(230)
)
LIMIT_PAGE = f"""
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Large Knowledge Catalog</title></head>
  <body><main><h1>Large Knowledge Catalog</h1>{LIMIT_ITEMS}</main></body>
</html>
"""


def extract_case(page, url, body, max_results=30):
    page.route(url, lambda route: route.fulfill(
        status=200,
        content_type="text/html",
        body=body,
    ))
    page.goto(url)
    page.evaluate(ENGINE)
    page.evaluate(ADAPTERS)
    start_result = page.evaluate(
        f"window.SpiderExtension.start({{ max: {max_results}, top: 0, timeout: 5000 }})"
    )
    evidence = page.evaluate(
        """
        () => ({
          values: [...document.querySelectorAll('.__spider-value')].map(element => element.textContent),
          rootTag: document.querySelector('[data-spider-root]')?.tagName,
          rootKind: document.querySelector('[data-spider-root]')?.getAttribute('data-spider-root'),
          controlsHidden: document.querySelector('#__spider-controls')?.hidden === true,
        })
        """
    )
    return start_result, evidence


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 900})
        article_result, article = extract_case(
            page,
            "https://publisher.example.test/story/universal-keywords",
            ARTICLE_PAGE,
        )
        product_result, product = extract_case(
            page,
            "https://shop.example.test/products/aurora",
            PRODUCT_PAGE,
        )
        limit_result, limit_evidence = extract_case(
            page,
            "https://catalog.example.test/topics",
            LIMIT_PAGE,
            200,
        )
        demo_page = browser.new_page(viewport={"width": 1200, "height": 900})
        demo_url = "https://demo.example.test/story/universal-keywords"
        demo_page.route(demo_url, lambda route: route.fulfill(
            status=200,
            content_type="text/html",
            body=ARTICLE_PAGE,
        ))
        demo_page.goto(demo_url)
        demo_page.evaluate(ENGINE)
        demo_page.evaluate(ADAPTERS)
        demo_page.evaluate(GENERIC_SITE)
        demo_adapter = demo_page.evaluate("window.Adapter.name")
        demo_results = demo_page.evaluate("window.Spider.extract(window.Adapter, 10)")
        browser.close()

    article_values = [value.lower() for value in article["values"]]
    product_values = [value.lower() for value in product["values"]]
    excluded_ui = [
        "pricing", "login", "newsletter", "subscribe", "cookies", "privacy",
        "sponsored", "cart", "checkout",
    ]

    assert article_result["ok"]
    assert article_result["adapter"] == "generic-article"
    assert article_result["pageType"] == "article"
    assert article["rootTag"] == "ARTICLE"
    assert article["rootKind"] == "generic-article"
    assert article["controlsHidden"]
    assert any("universal keyword extraction" in value for value in article_values)
    assert any("content scoring signals" in value for value in article_values)

    assert product_result["ok"]
    assert product_result["adapter"] == "generic-product"
    assert product_result["pageType"] == "product"
    assert product["rootKind"] == "generic-product"
    assert product["controlsHidden"]
    assert any("noise cancellation" in value for value in product_values)
    assert any("spatial audio" in value for value in product_values)

    all_values = article_values + product_values
    assert all(
        fragment not in value
        for fragment in excluded_ui
        for value in all_values
    )
    assert len(article_values) == len(set(article_values))
    assert len(product_values) == len(set(product_values))
    assert demo_adapter == "generic-article"
    assert any("universal keyword extraction" in item["value"].lower() for item in demo_results)
    assert limit_result["count"] == 200
    assert len(limit_evidence["values"]) == 200

    print(json.dumps({
        "article": {
            "adapter": article_result["adapter"],
            "root": article["rootTag"],
            "keywords": article["values"],
        },
        "product": {
            "adapter": product_result["adapter"],
            "root": product["rootTag"],
            "keywords": product["values"],
        },
        "playwrightDemo": {
            "adapter": demo_adapter,
            "resultCount": len(demo_results),
        },
        "configuredLimit": {
            "requested": 200,
            "collected": limit_result["count"],
        },
        "excludedUi": excluded_ui,
    }, indent=2))


if __name__ == "__main__":
    main()
