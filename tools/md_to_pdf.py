#!/usr/bin/env python3
"""Convert Markdown files to PDF (or self-contained HTML) with GitHub styling.

Local images referenced in the Markdown (PNG, SVG, JPEG, GIF, WebP, ...) are
inlined into the HTML as base64 data URIs, so they survive the temp-dir round
trip and end up in the PDF. The generated HTML is fully self-contained.
"""
from typing import Optional
import base64
import mimetypes
import re
import shutil
import subprocess
import tempfile
import argparse
from pathlib import Path
from urllib.parse import unquote, urlparse


def _to_data_uri(image_path: Path) -> Optional[str]:
    """Read an image file and return it as a base64 data URI (None if the MIME type is unknown)."""
    mime_type, _ = mimetypes.guess_type(str(image_path))
    if mime_type is None:
        # Sensible fallbacks for common cases mimetypes might miss
        suffix = image_path.suffix.lower()
        fallback: dict[str, str] = {".svg": "image/svg+xml", ".webp": "image/webp"}
        mime_type = fallback.get(suffix)
        if mime_type is None:
            return None
    encoded: str = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def embed_local_images(html_content: str, base_dir: Path) -> str:
    """Replace local image references in <img> tags with base64 data URIs.

    Remote images (http/https) and already-inlined data URIs are left untouched.
    Relative paths are resolved against ``base_dir`` (the Markdown file's directory).
    """
    img_pattern: re.Pattern[str] = re.compile(
        r'(<img\b[^>]*?\bsrc=)(["\'])(.*?)\2',
        re.IGNORECASE | re.DOTALL,
    )

    def _replace(match: re.Match[str]) -> str:
        prefix: str = match.group(1)
        quote: str = match.group(2)
        src: str = match.group(3)

        parsed = urlparse(src)
        if parsed.scheme in ("http", "https", "data", "file"):
            return match.group(0)

        rel_path: str = unquote(parsed.path)  # handle %20 etc.
        candidate: Path
        if Path(rel_path).is_absolute():
            candidate = Path(rel_path)
        else:
            candidate = (base_dir / rel_path).resolve()

        if not candidate.is_file():
            # grip sometimes roots local paths with a leading slash - retry without it
            alternative: Path = (base_dir / rel_path.lstrip("/")).resolve()
            if alternative.is_file():
                candidate = alternative
            else:
                print(f"⚠️  Image not found, leaving reference as-is: {src}")
                return match.group(0)

        data_uri: Optional[str] = _to_data_uri(candidate)
        if data_uri is None:
            print(f"⚠️  Unknown image type, leaving reference as-is: {src}")
            return match.group(0)

        return f"{prefix}{quote}{data_uri}{quote}"

    return img_pattern.sub(_replace, html_content)


def remove_github_header(html_content: str) -> str:
    """Strip the GitHub header box that grip adds to exported HTML."""
    pattern: str = r'<div class="Box-header[^>]*>.*?</div>'
    return re.sub(pattern, "", html_content, flags=re.DOTALL)


def _render_html(
    markdown_path: Path,
    html_file: Path,
    github_style: bool,
    strip_header: bool,
    embed_images: bool,
) -> None:
    """Render Markdown to HTML at ``html_file`` and post-process it in place."""
    if github_style:
        subprocess.run(["grip", str(markdown_path), "--export", str(html_file)], check=True)
    else:
        # -s/--standalone so pandoc emits a complete HTML document, not a fragment
        subprocess.run(["pandoc", "-s", str(markdown_path), "-o", str(html_file)], check=True)

    html_content: str = html_file.read_text(encoding="utf-8")

    if strip_header and github_style:
        html_content = remove_github_header(html_content)

    if embed_images:
        html_content = embed_local_images(html_content, markdown_path.parent)

    html_file.write_text(html_content, encoding="utf-8")


def convert_markdown(
    markdown_file: str,
    output_file: Optional[str] = None,
    github_style: bool = True,
    remove_header: bool = True,
    use_chrome: bool = True,
    chrome_path: Optional[str] = None,
    keep_html: bool = False,
    timeout: int = 20,
    html_only: bool = False,
    embed_images: bool = True,
) -> str:
    """Convert a Markdown file to PDF (or self-contained HTML with ``html_only=True``).

    Args:
        markdown_file: Path to the Markdown file.
        output_file: Output path (default: input path with .pdf or .html suffix).
        github_style: Use GitHub styling via grip (pandoc otherwise).
        remove_header: Remove the GitHub header box grip adds.
        use_chrome: Use headless Chrome for PDF conversion (wkhtmltopdf otherwise).
        chrome_path: Path to the Chrome executable (auto-detected if None).
        keep_html: Also keep the intermediate HTML file next to the Markdown file.
        timeout: Timeout in seconds for Chrome PDF generation.
        html_only: Only generate the self-contained HTML file, skip the PDF step.
        embed_images: Inline local images as base64 data URIs.

    Returns:
        Path to the created PDF (or HTML) file.
    """
    markdown_path: Path = Path(markdown_file).resolve()

    default_suffix: str = ".html" if html_only else ".pdf"
    if not output_file:
        output_file = str(markdown_path.with_suffix(default_suffix))
    output_path: Path = Path(output_file).resolve()

    if html_only:
        _render_html(markdown_path, output_path, github_style, remove_header, embed_images)
        return str(output_path)

    with tempfile.TemporaryDirectory() as temp_dir:
        html_file: Path = Path(temp_dir) / "output.html"
        _render_html(markdown_path, html_file, github_style, remove_header, embed_images)

        # Optionally keep a copy of the (self-contained) HTML next to the Markdown file
        if keep_html:
            html_output: Path = markdown_path.with_suffix(".html")
            shutil.copy2(html_file, html_output)
            print(f"HTML file saved to: {html_output}")

        if use_chrome:
            if not chrome_path:
                chrome_candidates: list[str] = [
                    # Linux
                    "/usr/bin/google-chrome",
                    "/usr/bin/google-chrome-stable",
                    "/usr/bin/chromium-browser",
                    "/usr/bin/chromium",
                    # macOS
                    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                    # Windows
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                ]
                for candidate in chrome_candidates:
                    if Path(candidate).exists():
                        chrome_path = candidate
                        print(f"using {chrome_path}")
                        break

            if not chrome_path or not Path(chrome_path).exists():
                raise FileNotFoundError(
                    "Google Chrome not found. Please specify the path using --chrome-path"
                )

            cmd: list[str] = [
                chrome_path,
                "--headless",
                "--print-to-pdf=" + str(output_path),
                "--no-pdf-header-footer",
                "--no-margins",
                "--portrait",
                str(html_file),
            ]

            print("Running Chrome to convert HTML to PDF...")
            process: subprocess.Popen[bytes] = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                process.kill()
                raise TimeoutError(f"Chrome PDF conversion timed out after {timeout} seconds")

            if not output_path.exists():
                _, stderr = process.communicate()
                raise RuntimeError(f"Chrome failed to create PDF. Error: {stderr.decode()}")
        else:
            if shutil.which("wkhtmltopdf"):
                subprocess.run(["wkhtmltopdf", str(html_file), str(output_path)], check=True)
            else:
                raise FileNotFoundError(
                    "wkhtmltopdf not found. Please install it or use Chrome (default)"
                )

    return str(output_path)


def find_grip() -> bool:
    """Check if grip is installed."""
    return shutil.which("grip") is not None


def process_directory(
    directory: str,
    github_style: bool = True,
    remove_header: bool = True,
    use_chrome: bool = True,
    chrome_path: Optional[str] = None,
    keep_html: bool = False,
    timeout: int = 20,
    force: bool = False,
    html_only: bool = False,
    embed_images: bool = True,
) -> tuple[int, int]:
    """Process all Markdown files in a directory recursively.

    Returns:
        Tuple of (converted_count, skipped_count).
    """
    dir_path: Path = Path(directory).resolve()

    if not dir_path.is_dir():
        raise NotADirectoryError(f"'{directory}' is not a directory")

    md_files: list[Path] = list(dir_path.rglob("*.md"))

    if not md_files:
        print(f"No Markdown files found in '{directory}'")
        return 0, 0

    target_suffix: str = ".html" if html_only else ".pdf"
    converted: int = 0
    skipped: int = 0

    print(f"Found {len(md_files)} Markdown file(s) in '{directory}'")
    print()

    for md_file in md_files:
        target_file: Path = md_file.with_suffix(target_suffix)

        if target_file.exists() and not force:
            print(f"⏭️  Skipping (output exists): {md_file.relative_to(dir_path)}")
            skipped += 1
            continue

        try:
            print(f"📄 Converting: {md_file.relative_to(dir_path)}")
            convert_markdown(
                str(md_file),
                str(target_file),
                github_style=github_style,
                remove_header=remove_header,
                use_chrome=use_chrome,
                chrome_path=chrome_path,
                keep_html=keep_html,
                timeout=timeout,
                html_only=html_only,
                embed_images=embed_images,
            )
            print(f"✅ Created: {target_file.relative_to(dir_path)}")
            converted += 1
        except Exception as e:
            print(f"❌ Error converting {md_file.relative_to(dir_path)}: {e}")

        print()

    return converted, skipped


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert Markdown to PDF (or self-contained HTML) without GitHub header"
    )
    parser.add_argument("input", help="Input markdown file or directory")
    parser.add_argument("-o", "--output", help="Output file (only used when input is a file)")
    parser.add_argument("--no-github", action="store_false", dest="github",
                        help="Don't use GitHub styling")
    parser.add_argument("--keep-header", action="store_false", dest="remove_header", default=True,
                        help="Keep GitHub header")
    parser.add_argument("--use-wkhtmltopdf", action="store_true", default=False,
                        help="Use wkhtmltopdf instead of Chrome for PDF conversion")
    parser.add_argument("--chrome-path", help="Path to Chrome executable")
    parser.add_argument("--keep-html", action="store_true",
                        help="Keep the intermediate HTML file")
    parser.add_argument("--html-only", action="store_true",
                        help="Only generate a self-contained HTML file, skip PDF generation")
    parser.add_argument("--no-embed-images", action="store_false", dest="embed_images",
                        default=True,
                        help="Don't inline local images as base64 data URIs")
    parser.add_argument("--timeout", type=int, default=20,
                        help="Timeout in seconds for Chrome PDF generation (default: 20)")
    parser.add_argument("--force", "-f", action="store_true",
                        help="Force conversion even if output already exists (directory mode)")

    args: argparse.Namespace = parser.parse_args()

    if not find_grip():
        print("Error: grip is not installed. Please install it with 'pip install grip'")
        exit(1)

    input_path: Path = Path(args.input)

    try:
        if input_path.is_dir():
            if args.output:
                print("Warning: --output parameter is ignored when processing a directory")

            converted, skipped = process_directory(
                args.input,
                github_style=args.github,
                remove_header=args.remove_header,
                use_chrome=not args.use_wkhtmltopdf,
                chrome_path=args.chrome_path,
                keep_html=args.keep_html,
                timeout=args.timeout,
                force=args.force,
                html_only=args.html_only,
                embed_images=args.embed_images,
            )

            print(f"✅ Converted: {converted} file(s)")
            print(f"⏭️  Skipped: {skipped} file(s)")

        elif input_path.is_file():
            result: str = convert_markdown(
                args.input,
                args.output,
                github_style=args.github,
                remove_header=args.remove_header,
                use_chrome=not args.use_wkhtmltopdf,
                chrome_path=args.chrome_path,
                keep_html=args.keep_html,
                timeout=args.timeout,
                html_only=args.html_only,
                embed_images=args.embed_images,
            )
            print(f"Created: {result}")
        else:
            print(f"Error: '{args.input}' is neither a file nor a directory")
            exit(1)

    except Exception as e:
        print(f"Error: {e}")
        exit(1)