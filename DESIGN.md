# Strike Yard Design System

## Direction

A warm, daylight-friendly operations interface for a busy cafe beside sports courts. Deep pitch green anchors navigation and primary actions; warm cream surfaces reduce glare; saffron and terracotta are reserved for attention and risk.

## Color

- Pitch: deep green for primary actions, active navigation, and trusted totals.
- Cream: warm page background and secondary surfaces.
- Surface: lightly tinted white for forms, receipts, and dense data.
- Saffron: waiting, urgency, and operational attention.
- Terracotta: destructive actions, unpaid balances, and errors.
- Ink: green-tinted near-black for readable text.

All implemented colors use the OKLCH tokens in `src/app/globals.css`.

## Typography

- Fraunces is used sparingly for cafe identity, page titles, and important totals.
- Karla carries controls, labels, tables, and body copy.
- Numeric values use tabular figures where alignment matters.

## Shape And Elevation

- Controls use a 10px radius; larger contained surfaces use 16px.
- Borders define most structure. Shadows are reserved for raised receipts and focused operational surfaces.
- Avoid nested cards. Prefer dividers, columns, and grouped rows for dense information.

## Interaction

- Most transitions run 150 to 260ms with smooth exponential easing.
- Motion communicates opening, closing, selection, and successful state changes.
- Every important action has hover, focus, active, disabled, and error treatment.

## Layout

- Staff tools use a persistent desktop sidebar and mobile bottom navigation.
- Owner views use a readable centered canvas with responsive summary bands and horizontally safe data lists.
- Customer ordering remains mobile-first.
