"""Seam: the link rules as pure functions (Sprint 005a, #89; D-19 pure-function seam).

Spec #86: builder links are `https://` only, at most 500 characters, never localhost, an IP
literal or an IDN-lookalike host; the pitch video is YouTube only (`watch?v=`, `youtu.be/`,
`shorts/`, `embed/`) and yields its 11-character video id; GitHub and LinkedIn links keep to
their host allow-list. Every violation raises `LinkError` naming the field, so the API (#94) can
answer 422 with that field.
"""

import pytest

from app.marketplace.links import (
    MAX_URL_LENGTH,
    LinkError,
    github_profile_url,
    linkedin_profile_url,
    validate_https_url,
    youtube_video_id,
)

VID = "dQw4w9WgXcQ"

ACCEPTED_URLS = [
    "https://example.com",
    "https://example.com/path?q=1#frag",
    "https://www.venture-route.dev/showcase/amina",
    "HTTPS://Example.com/",
    "https://example.com:8443/x",
    "  https://example.com/trimmed  ",
    "https://example.com/" + "a" * (MAX_URL_LENGTH - len("https://example.com/")),
]


@pytest.mark.parametrize("url", ACCEPTED_URLS)
def test_https_url_is_accepted_and_returned_trimmed(url: str) -> None:
    assert validate_https_url(url, field="demoUrl") == url.strip()


REJECTED_URLS = [
    ("http://example.com", "https"),
    ("ftp://example.com", "https"),
    ("javascript:alert(1)", "https"),
    ("//example.com/x", "https"),
    ("example.com", "https"),
    ("", "https"),
    ("https://", "host"),
    ("https://localhost/x", "localhost"),
    ("https://LOCALHOST:3000", "localhost"),
    ("https://localhost./x", "localhost"),
    ("https://api.localhost/x", "localhost"),
    ("https://127.0.0.1/x", "IP"),
    ("https://10.0.0.5", "IP"),
    ("https://[::1]/x", "IP"),
    ("https://[2001:db8::1]:8443/", "IP"),
    ("https://2130706433/", "IP"),
    ("https://0x7f.1/", "IP"),
    ("https://intranet/x", "domain"),
    ("https://xn--80ak6aa92e.com/", "IDN"),
    ("https://www.xn--ggle-0nda.com/", "IDN"),
    ("https://gооgle.com/", "IDN"),  # Cyrillic о
    ("https://github.com@evil.com/", "credentials"),
    ("https://user:pass@example.com/", "credentials"),
    (r"https://evil.com\@github.com/", "backslash"),
    ("https://exa mple.com/", "whitespace"),
    ("https://example.com/\nx", "whitespace"),
    ("https://example.com:99999/", "port"),
    ("https://example.com/" + "a" * (MAX_URL_LENGTH + 1 - len("https://example.com/")), "500"),
]


@pytest.mark.parametrize(("url", "reason"), REJECTED_URLS)
def test_https_url_violation_names_the_field(url: str, reason: str) -> None:
    with pytest.raises(LinkError) as caught:
        validate_https_url(url, field="demoUrl")
    assert caught.value.field == "demoUrl"
    assert reason in caught.value.message
    assert str(caught.value).startswith("demoUrl: ")


def test_link_error_is_a_value_error() -> None:
    assert issubclass(LinkError, ValueError)


VIDEO_URLS = [
    f"https://youtu.be/{VID}",
    f"https://youtu.be/{VID}?si=AbCdEf123",
    f"https://youtu.be/{VID}?t=42",
    f"https://www.youtube.com/watch?v={VID}",
    f"https://www.youtube.com/watch?v={VID}&t=30s",
    f"https://youtube.com/watch?si=xyz&v={VID}",
    f"https://m.youtube.com/watch?v={VID}&feature=share",
    f"https://www.youtube.com/shorts/{VID}",
    f"https://www.youtube.com/shorts/{VID}?si=AbCd",
    f"https://youtube.com/embed/{VID}",
    f"https://www.youtube.com/embed/{VID}?start=10",
    f"https://www.youtube-nocookie.com/embed/{VID}",
    f"https://youtube-nocookie.com/embed/{VID}/",
    "https://youtu.be/a-b_C1234Z9",
]


@pytest.mark.parametrize("url", VIDEO_URLS)
def test_youtube_video_id_is_extracted(url: str) -> None:
    expected = url.split("youtu.be/")[-1][:11] if "youtu.be/" in url else VID
    assert youtube_video_id(url, field="pitchVideoUrl") == expected


REJECTED_VIDEOS = [
    f"http://www.youtube.com/watch?v={VID}",
    f"https://vimeo.com/{VID}",
    f"https://youtube.com.evil.com/watch?v={VID}",
    f"https://evilyoutube.com/watch?v={VID}",
    f"https://music.youtube.com/watch?v={VID}",
    f"https://www.youtube-nocookie.com/watch?v={VID}",
    "https://www.youtube.com/watch?v=short",
    f"https://www.youtube.com/watch?v={VID}x",
    "https://www.youtube.com/watch?v=dQw4w9WgXc!",
    "https://www.youtube.com/watch?list=PL123",
    f"https://www.youtube.com/watch?v={VID}&v=aaaaaaaaaaa",
    "https://www.youtube.com/",
    f"https://www.youtube.com/channel/{VID}",
    f"https://www.youtube.com/shorts/{VID}/extra",
    "https://youtu.be/",
    f"https://youtu.be/{VID}/extra",
    f"https://127.0.0.1/watch?v={VID}",
]


@pytest.mark.parametrize("url", REJECTED_VIDEOS)
def test_non_youtube_pitch_video_names_the_field(url: str) -> None:
    with pytest.raises(LinkError) as caught:
        youtube_video_id(url, field="pitchVideoUrl")
    assert caught.value.field == "pitchVideoUrl"


@pytest.mark.parametrize(
    "url",
    [
        "https://github.com/amina-otieno",
        "https://www.github.com/amina-otieno",
        "https://GitHub.com/amina-otieno/",
    ],
)
def test_github_host_is_accepted(url: str) -> None:
    assert github_profile_url(url, field="githubUrl") == url


@pytest.mark.parametrize(
    "url",
    [
        "https://linkedin.com/in/amina-otieno",
        "https://www.linkedin.com/in/amina-otieno/",
    ],
)
def test_linkedin_host_is_accepted(url: str) -> None:
    assert linkedin_profile_url(url, field="linkedinUrl") == url


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/amina",
        "https://gitlab.com/amina",
        "https://gist.github.com/amina",
        "https://github.com.evil.com/amina",
        "https://evilgithub.com/amina",
        "https://www.linkedin.com/in/amina",
        "https://github.com@evil.com/amina",
        "https://github.com:8443/amina",
    ],
)
def test_github_host_mismatch_names_the_field(url: str) -> None:
    with pytest.raises(LinkError) as caught:
        github_profile_url(url, field="githubUrl")
    assert caught.value.field == "githubUrl"


@pytest.mark.parametrize(
    "url",
    [
        "http://www.linkedin.com/in/amina",
        "https://uk.linkedin.com/in/amina",
        "https://linkedin.com.evil.com/in/amina",
        "https://github.com/amina",
        "https://lnkd.in/abc",
        "https://www.linkedin.com:444/in/amina",
    ],
)
def test_linkedin_host_mismatch_names_the_field(url: str) -> None:
    with pytest.raises(LinkError) as caught:
        linkedin_profile_url(url, field="linkedinUrl")
    assert caught.value.field == "linkedinUrl"
