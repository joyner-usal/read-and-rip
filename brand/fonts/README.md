# Brand fonts (placeholders)

`brand/tokens.css` expects these files here:

| File | Family | Weight | Use |
| --- | --- | --- | --- |
| `VanguardCF-Bold.woff2` | Vanguard CF | 700 | Display, buttons |
| `VanguardCF-Heavy.woff2` | Vanguard CF | 900 | Big score, title |
| `Mundial-Regular.woff2` | Mundial | 400 | Body |
| `Mundial-DemiBold.woff2` | Mundial | 600 | Labels, emphasis |

Until they are added, the browser falls back to the next font in each stack
(Barlow Condensed or Arial Narrow for display, Avenir or Segoe UI for body).
Nothing breaks.

**Never commit these files.** The repo is public, and `.gitignore` blocks font
files in this folder (BUILD.md D22). Drop them in locally to preview the real type;
v1 ships with the fallbacks (BUILD.md D24) until HQ confirms web rights and
hosting. If the weights you have differ, rename the `src` lines in
`brand/tokens.css` to match.
