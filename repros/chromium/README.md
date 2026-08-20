Chromium bug reports (Android View Transitions)

Two issues. File them separately on https://issues.chromium.org/issues/new
Copy from the matching .txt (plain text, form field order).

01  01-android-vt-url-bar-aborts-transition.txt
    Repro: https://ramka-docs-git-chromium-bug-report-artur-bies-projects.vercel.app/debug/chromium-url-bar.html
    Photos down the page. Scroll while the URL bar is moving, tap a photo, tap overlay to close.

02  02-safe-area-inset-fixed-overlay-fires-resize.txt
    Repro: https://ramka-docs-git-chromium-bug-report-artur-bies-projects.vercel.app/debug/chromium-safe-area-resize.html

Chrome Android, URL bar showing, tab in the foreground. Do not use viewport-fit=cover.

Local copies of the HTML: 01-android-vt-url-bar-aborts-transition.html and 02-safe-area-inset-fixed-overlay-fires-resize.html (also apps/docs/public/debug/).
