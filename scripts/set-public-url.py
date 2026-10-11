#!/usr/bin/env python3
"""Set NEXT_PUBLIC_APP_URL in the Droplet .env.

Prints only the new URL. Does not change MOCK_ORDERS or any other key.
Does not recreate the app container. See docs/PUBLIC_HOSTNAME.md.
"""

from __future__ import annotations

import sys
from pathlib import Path

ENV_PATH = Path("/srv/cmdesk/.env")
KEY = "NEXT_PUBLIC_APP_URL="


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: set-public-url.py https://hostname", file=sys.stderr)
        return 2
    url = sys.argv[1].strip().rstrip("/")
    if not url.startswith("https://") or " " in url or url == "https://":
        print("url-must-be-https", file=sys.stderr)
        return 2
    if not ENV_PATH.is_file():
        print("env-missing", file=sys.stderr)
        return 1

    text = ENV_PATH.read_text(encoding="utf-8")
    newline = "\n" if text.endswith("\n") or text == "" else ""
    lines = text.splitlines()
    found = False
    updated: list[str] = []
    for line in lines:
        if line.startswith(KEY):
            updated.append(f"{KEY}{url}")
            found = True
        else:
            updated.append(line)
    if not found:
        print("url-line-missing", file=sys.stderr)
        return 1
    ENV_PATH.write_text("\n".join(updated) + newline, encoding="utf-8")
    print(f"url-updated {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
