"""Link rules for builder profile and showcase URLs (Sprint 005a, spec #86, #89).

Pure functions, stdlib only: no network call and no DNS lookup, so a verdict depends on the
string alone. The URLs these functions accept end up as `href`s and embeds on a public page.

Contract (#94 builder writes depend on it):

- Every function takes the URL and a keyword-only `field` (the API field name, e.g.
  `"pitchVideoUrl"`). On success it returns a value: the trimmed URL, or for
  `youtube_video_id` the 11-character video id. On any violation it raises `LinkError`, a
  `ValueError` carrying `.field` and `.message`; `str(error)` is `"<field>: <message>"`. The
  API turns it into a 422 naming `error.field`.
- Leading and trailing whitespace is trimmed before checking; the trimmed value is what the
  caller should store.

`validate_https_url` rules, in order:

1. At most `MAX_URL_LENGTH` (500) characters.
2. No whitespace, control characters or backslashes anywhere (a browser reads a backslash
   as `/`, so `evil.com` + backslash + `@github.com` would otherwise pass for a GitHub link).
3. Scheme `https` (case-insensitive) with a host; no `user:password@` credentials; a valid port.
4. IDN-lookalike rule, deliberately simple: the host must be plain ASCII and no label may start
   with `xn--` (punycode). Internationalised domains are refused outright rather than judged.
5. Not `localhost` or any `*.localhost` host (a trailing dot is ignored).
6. Not an IP literal: IPv4, bracketed IPv6, or a host whose last label is numeric or `0x` hex
   (browsers read `https://2130706433/` and `https://0x7f.1/` as IPv4 addresses).
7. A public domain name: at least two dot-separated labels of `[a-z0-9-]`.

`youtube_video_id` accepts only `https://` YouTube links, after the rules above:
`youtube.com`, `www.youtube.com`, `m.youtube.com` with `/watch?v=<id>`, `/shorts/<id>` or
`/embed/<id>`; `youtu.be/<id>`; `youtube-nocookie.com` and `www.youtube-nocookie.com` with
`/embed/<id>` only. Extra query parameters (`&t=30s`, `si=`, `feature=`) are ignored; a single
trailing slash is allowed; the id is exactly 11 characters of `[A-Za-z0-9_-]`. No port.

`github_profile_url` / `linkedin_profile_url` apply the same rules plus a host allow-list
(`github.com` / `www.github.com`, `linkedin.com` / `www.linkedin.com`) and no explicit port.
"""

from __future__ import annotations

import ipaddress
import re
from urllib.parse import SplitResult, parse_qs, urlsplit

MAX_URL_LENGTH = 500

YOUTUBE_HOSTS = frozenset({"youtube.com", "www.youtube.com", "m.youtube.com"})
YOUTU_BE_HOSTS = frozenset({"youtu.be"})
NOCOOKIE_HOSTS = frozenset({"youtube-nocookie.com", "www.youtube-nocookie.com"})
GITHUB_HOSTS = frozenset({"github.com", "www.github.com"})
LINKEDIN_HOSTS = frozenset({"linkedin.com", "www.linkedin.com"})

_VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{11}")
_LABEL = re.compile(r"[a-z0-9-]+")
_NUMERIC_LABEL = re.compile(r"(?:0x[0-9a-f]*|[0-9]+)")
_UNSAFE_CHAR = re.compile(r"[\s\x00-\x1f\x7f]")


class LinkError(ValueError):
    """A link that breaks a rule; `field` names the API field for the 422."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(f"{field}: {message}")
        self.field = field
        self.message = message


def _checked(url: str, field: str) -> tuple[str, SplitResult, str]:
    """The trimmed URL, its parts and its lower-case host, or LinkError."""
    value = url.strip()
    if len(value) > MAX_URL_LENGTH:
        raise LinkError(field, f"must be at most {MAX_URL_LENGTH} characters")
    if "\\" in value:
        raise LinkError(field, "must not contain a backslash")
    if _UNSAFE_CHAR.search(value):
        raise LinkError(field, "must not contain whitespace or control characters")
    parts = urlsplit(value)
    if parts.scheme != "https":
        raise LinkError(field, "must be an https:// URL")
    if not parts.netloc:
        raise LinkError(field, "must have a host")
    if "@" in parts.netloc:
        raise LinkError(field, "must not contain credentials")
    try:
        parts.port  # noqa: B018 - the property raises on an invalid port
    except ValueError as exc:
        raise LinkError(field, "port is invalid") from exc
    host = (parts.hostname or "").rstrip(".")
    if not host:
        raise LinkError(field, "must have a host")
    if not host.isascii() or any(label.startswith("xn--") for label in host.split(".")):
        raise LinkError(field, "IDN-lookalike hosts are not allowed")
    if host == "localhost" or host.endswith(".localhost"):
        raise LinkError(field, "localhost is not allowed")
    if _is_ip_literal(host):
        raise LinkError(field, "IP-literal hosts are not allowed")
    labels = host.split(".")
    if len(labels) < 2 or not all(_LABEL.fullmatch(label) for label in labels):
        raise LinkError(field, "host must be a public domain name")
    return value, parts, host


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return bool(_NUMERIC_LABEL.fullmatch(host.split(".")[-1]))
    return True


def validate_https_url(url: str, *, field: str) -> str:
    """The trimmed URL when it follows every link rule, else LinkError naming `field`."""
    value, _, _ = _checked(url, field)
    return value


def _single_segment(path: str, prefix: str) -> str | None:
    """The one path segment after `prefix` (a trailing slash allowed), else None."""
    if not path.startswith(prefix):
        return None
    rest = path[len(prefix) :]
    rest = rest.removesuffix("/")
    return rest if rest and "/" not in rest else None


def youtube_video_id(url: str, *, field: str) -> str:
    """The 11-character video id of a YouTube link, else LinkError naming `field`."""
    _, parts, host = _checked(url, field)
    candidate: str | None = None
    if parts.port is None:
        if host in YOUTU_BE_HOSTS:
            candidate = _single_segment(parts.path, "/")
        elif host in NOCOOKIE_HOSTS:
            candidate = _single_segment(parts.path, "/embed/")
        elif host in YOUTUBE_HOSTS:
            if parts.path == "/watch":
                values = parse_qs(parts.query, keep_blank_values=True).get("v", [])
                candidate = values[0] if len(values) == 1 else None
            else:
                candidate = _single_segment(parts.path, "/shorts/") or _single_segment(
                    parts.path, "/embed/"
                )
    if candidate is None or not _VIDEO_ID.fullmatch(candidate):
        raise LinkError(
            field,
            "must be a YouTube video link (watch?v=, youtu.be/, shorts/ or embed/)",
        )
    return candidate


def _allow_listed(url: str, field: str, hosts: frozenset[str], site: str) -> str:
    value, parts, host = _checked(url, field)
    if host not in hosts or parts.port is not None:
        raise LinkError(field, f"must be a {site} link ({' or '.join(sorted(hosts))})")
    return value


def github_profile_url(url: str, *, field: str) -> str:
    """The trimmed URL when it is an https GitHub link, else LinkError naming `field`."""
    return _allow_listed(url, field, GITHUB_HOSTS, "GitHub")


def linkedin_profile_url(url: str, *, field: str) -> str:
    """The trimmed URL when it is an https LinkedIn link, else LinkError naming `field`."""
    return _allow_listed(url, field, LINKEDIN_HOSTS, "LinkedIn")
