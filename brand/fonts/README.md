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

Before adding the files, confirm the USA Lacrosse license covers **web
embedding** (self-hosting WOFF2 on a public site). A desktop license alone is
not enough. If the weights you have differ, rename the `src` lines in
`brand/tokens.css` to match.
