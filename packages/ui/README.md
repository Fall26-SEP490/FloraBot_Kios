# Shared UI colors

`src/tokens.css` defines the shared green/white palette. Landing uses these
semantic tokens for repeated surfaces and controls:

| Token                  | Value          | Use                                                        |
| ---------------------- | -------------- | ---------------------------------------------------------- |
| `--color-canvas`       | `oklch(1 0 0)` | White page, form and image surfaces                        |
| `--color-on-ink`       | `#fff`         | Text on dark green surfaces                                |
| `--color-divider`      | `#b8cbb2`      | Decorative section and panel borders; not input boundaries |
| `--color-surface-soft` | `#f0f7e9`      | Pale green hero and registration backgrounds               |
| `--color-action-hover` | `#346d41`      | Hover background for dark green actions                    |

Keep `--color-line` for input/control boundaries where contrast is needed.
These tokens preserve existing colors. One-off illustration, map and decorative
colors remain local; this palette does not add a dark theme.
