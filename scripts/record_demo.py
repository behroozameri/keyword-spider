import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
DEMO_HTML = (ROOT / "demo" / "index.html").read_text(encoding="utf-8")
ENGINE = (ROOT / "engine" / "spider.js").read_text(encoding="utf-8")
ADAPTERS = (ROOT / "extension" / "adapters.js").read_text(encoding="utf-8")
DEMO_URL = "https://demo.keyword-spider.dev/field-notes"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Record a privacy-safe Keyword Spider product demo."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "videos" / "keyword-spider-linkedin-demo.mp4",
        help="MP4 output path",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=8,
        help="Number of top-ranked targets the spider should visit (default: 8)",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=2.2,
        help="Animation speed multiplier (default: 2.2)",
    )
    parser.add_argument(
        "--keep-webm",
        action="store_true",
        help="Keep the original Playwright WebM recording next to the MP4",
    )
    args = parser.parse_args()
    if args.top < 1:
        parser.error("--top must be at least 1")
    if not 0.5 <= args.speed <= 3:
        parser.error("--speed must be between 0.5 and 3")
    return args


def convert_to_mp4(source, destination):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg is required to create the LinkedIn-ready MP4 file.")
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(source),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-r",
            "30",
            str(destination),
        ],
        check=True,
    )


def record_demo(top, speed, recording_dir):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1080, "height": 1080},
            color_scheme="dark",
            record_video_dir=str(recording_dir),
            record_video_size={"width": 1080, "height": 1080},
        )
        page = context.new_page()
        page.route(
            DEMO_URL,
            lambda route: route.fulfill(
                status=200,
                content_type="text/html",
                body=DEMO_HTML,
            ),
        )
        page.goto(DEMO_URL, wait_until="load")
        page.wait_for_timeout(1800)
        page.evaluate(ENGINE)
        page.evaluate(ADAPTERS)
        result = page.evaluate(
            """
            async ({ top, speed }) => {
              const adapter = window.SpiderAdapters.select();
              const results = await window.Spider.extract(adapter, 30);
              const speedControl = document.querySelector('#__spider-speed');
              speedControl.value = String(speed);
              speedControl.dispatchEvent(new Event('input'));
              await window.Spider.sleep(1200);
              const summary = await window.Spider.animate(90000, Math.min(top, results.length));
              return { adapter: adapter.name, results: results.length, summary };
            }
            """,
            {"top": top, "speed": speed},
        )
        page.wait_for_timeout(2800)
        video = page.video
        context.close()
        raw_path = Path(video.path())
        browser.close()
    return raw_path, result


def main():
    args = parse_args()
    output_path = args.output.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="keyword-spider-demo-") as temp_dir:
        raw_path, result = record_demo(args.top, args.speed, Path(temp_dir))
        convert_to_mp4(raw_path, output_path)
        if args.keep_webm:
            shutil.copy2(raw_path, output_path.with_suffix(".webm"))

    print(
        f"Recorded {result['summary']['animated']} animated targets "
        f"from {result['results']} ranked results using {result['adapter']}."
    )
    print(f"Created {output_path}")


if __name__ == "__main__":
    main()
