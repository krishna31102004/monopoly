# World Cities Design System

Phase 1 provides shared presentation foundations. It does not change game rules, layouts, or server behaviour.

## Surfaces and colour

- **Midnight shell:** `--wc-midnight` and navy elevation tokens are for application controls, panels, modal shells, auctions, and trades.
- **Warm surfaces:** `--wc-ivory`, `--wc-paper`, and `--wc-board-frame` retain the physical-board/deed feel.
- **Primary action:** metallic gold (`--wc-gold`) with dark navy text.
- **States:** emerald means success/ready, rose means debt/danger, amber means warning, blue is informational, and slate is inactive.
- **Property identity:** the single city palette remains in `src/lib/ui/propertyColors.ts`. Use it only for asset bands, group badges, ownership markers, and selected outlines—not generic calls to action or large panels.

## Typography and layout

Use `.wc-display`, `.wc-heading`, `.wc-panel-heading`, `.wc-property-heading`, `.wc-section-label`, and `.wc-caption` for hierarchy. Labels are uppercase and tracked; ordinary body copy is not.

Apply `.wc-numeric` to cash, bids, rents, dice totals, counts, and timers. `.wc-room-code` adds a stable monospace treatment for room codes. Shared CSS variables define page, panel, card, section, control, and safe-area spacing; mobile touch controls are at least 44px (`--wc-touch-target`).

## Primitives

- Surfaces: `.wc-panel`, `.wc-card`, `.wc-paper-card`, `.wc-empty-state`
- Controls: `.wc-button` plus `-primary`, `-secondary`, `-success`, `-danger`, `-warning`, `-ghost`, and `-icon`
- Status: `.wc-badge` plus gold, success, danger, warning, or muted variants
- Support: `.wc-validation-*`, `.wc-divider`, `.wc-sticky-footer`, `.wc-property-band`, `.wc-input`, `.wc-select`

The primitives are opt-in during the staged redesign so existing game screens remain stable.

## Accessibility and motion

All focusable controls receive a visible gold `:focus-visible` outline. Statuses retain visible text rather than colour alone. `getDesignReadableTextColor` selects a safe dark/white foreground for dynamic accent use. The global reduced-motion query shortens nonessential motion; presentation timings never control game-state timing.

## Icons and review

`src/components/ui/UiIcon.tsx` supplies small, monochrome inline SVG icons without adding a dependency. Decorative icons are hidden from assistive technology; interactive icon controls need an explicit accessible label.

Run the development server and visit `/dev/design-system` to review the palette, typography, buttons, badges, surfaces, property bands, fields, focus styles, and icon foundation locally.
