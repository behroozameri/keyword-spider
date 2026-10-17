import argparse
import json
import os
import re
import sys
import time
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).parent
ENGINE = (ROOT / "engine/spider.js").read_text(encoding="utf-8")
SHARED_ADAPTERS = (ROOT / "extension/adapters.js").read_text(encoding="utf-8")
DATA_ROOT = Path(
    os.environ.get("SPIDER_DATA_DIR", Path.home() / ".spider-crawler")
).expanduser()

# Register new site adapters here.
SITES = [
    {
        "name": "wikipedia",
        "match": r"wikipedia\.org/wiki/",
        "js": "sites/wikipedia.js",
        "persistent": False,
    },
    {
        "name": "linkedin",
        "match": r"linkedin\.com/jobs",
        "js": "sites/linkedin.js",
        "persistent": True,
    },
]
GENERIC = {
    "name": "generic",
    "match": "",
    "js": "sites/generic.js",
    "persistent": False,
}


def pick_site(url, forced=None):
    if forced:
        for site in SITES + [GENERIC]:
            if site["name"] == forced:
                return site
        available = [site["name"] for site in SITES + [GENERIC]]
        sys.exit(f"Unknown site '{forced}'. Available adapters: {available}")
    for site in SITES:
        if re.search(site["match"], url):
            return site
    return GENERIC


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract English keywords from a web page and animate a spider visiting them."
    )
    parser.add_argument("url", help="Page URL to inspect")
    parser.add_argument("--site", help="Force a specific site adapter")
    parser.add_argument(
        "--max", type=int, default=40, help="Maximum number of targets (default: 40)"
    )
    parser.add_argument(
        "--top",
        type=int,
        default=12,
        help="Number of top-ranked targets to animate (default: 12)",
    )
    parser.add_argument(
        "--headless", action="store_true", help="Run Chromium without a visible window"
    )
    parser.add_argument(
        "--record-video",
        action="store_true",
        help="Record the browser session to the videos directory",
    )
    parser.add_argument(
        "--profile-dir",
        type=Path,
        help="Persistent browser profile directory (default: ~/.spider-crawler/profiles/<site>)",
    )
    parser.add_argument(
        "--navigation-timeout",
        type=float,
        default=30,
        help="Navigation timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--animation-timeout",
        type=float,
        default=120,
        help="Total animation timeout in seconds (default: 120)",
    )
    parser.add_argument(
        "--skip-login-prompt",
        action="store_true",
        help="Do not pause for login or CAPTCHA on persistent sites",
    )
    parser.add_argument(
        "--keep-open",
        action="store_true",
        help="Keep the browser open after animation so the results panel remains usable",
    )
    args = parser.parse_args()
    if args.max < 0:
        parser.error("--max must be zero or greater")
    if args.top < 0:
        parser.error("--top must be zero or greater")
    if args.navigation_timeout <= 0 or args.animation_timeout <= 0:
        parser.error("timeouts must be greater than zero")
    return args


def main():
    args = parse_args()
    site = pick_site(args.url, args.site)
    adapter_js = (ROOT / site["js"]).read_text(encoding="utf-8")
    print(f"Adapter: {site['name']}")

    context_options = {
        "viewport": {"width": 1100, "height": 1300},
        "color_scheme": "dark",
    }
    if args.record_video:
        video_dir = ROOT / "videos"
        video_dir.mkdir(parents=True, exist_ok=True)
        context_options.update(
            record_video_dir=str(video_dir),
            record_video_size={"width": 1100, "height": 1300},
        )

    with sync_playwright() as playwright:
        if site["persistent"]:
            profile_dir = (
                args.profile_dir or DATA_ROOT / "profiles" / site["name"]
            ).expanduser().resolve()
            profile_dir.mkdir(parents=True, exist_ok=True)
            print(f"Browser profile: {profile_dir}")
            context = playwright.chromium.launch_persistent_context(
                str(profile_dir), headless=args.headless, **context_options
            )
            browser = None
        else:
            browser = playwright.chromium.launch(headless=args.headless)
            context = browser.new_context(**context_options)

        page = context.pages[0] if context.pages else context.new_page()
        page.on("console", lambda message: print("[browser]", message.text))
        page.on("pageerror", lambda error: print("[page error]", error))

        exit_code = 0
        try:
            page.goto(
                args.url,
                wait_until="load",
                timeout=args.navigation_timeout * 1000,
            )
            if site["persistent"] and not args.skip_login_prompt:
                input("Complete login or CAPTCHA if needed, then press Enter... ")
            time.sleep(2)
            page.evaluate(ENGINE)
            if site["name"] == "generic":
                page.evaluate(SHARED_ADAPTERS)
            page.evaluate(adapter_js)

            # Persist extraction before animation so visual failures cannot lose data.
            data = page.evaluate(
                "max => window.Spider.extract(window.Adapter, max)", args.max
            )
            output_path = ROOT / f"result_{site['name']}.json"
            output_path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            print(f"Extracted: {len(data)} -> {output_path.name}")

            try:
                summary = page.evaluate(
                    "options => window.Spider.animate(options.timeout, options.top)",
                    {
                        "timeout": int(args.animation_timeout * 1000),
                        "top": args.top,
                    },
                )
                print(
                    "Animation: "
                    f"{summary['animated']} animated, {summary['skipped']} skipped"
                )
            except Exception as animation_error:
                print(
                    "Animation failed, but extracted data is safely stored: "
                    f"{animation_error}",
                    file=sys.stderr,
                )

            if args.keep_open and not args.headless:
                input("The results panel is ready. Press Enter to close the browser... ")
            elif not args.headless:
                time.sleep(3)
        except Exception:
            traceback.print_exc()
            exit_code = 1
        finally:
            try:
                page.evaluate("window.Spider?.cleanup?.()")
            except Exception:
                pass
            context.close()
            if browser:
                browser.close()
        return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
