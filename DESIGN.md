# Design System Documentation: Aquamarine Sentinel (Master Hub Redesign)

This document details the design system parameters for the **AquaOps Executive Hub** (referred to as the Master Hub Redesign). It is engineered for industrial aquaculture environments, projecting **Mission-Critical Precision** and **Operational Authority**.

---

## 1. Theme Tokens (Core Color Palette)

The color palette is anchored by deep, stable ocean tones, crisp highlighted interactions, and clean status representations.

### Named Color Tokens
| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Deep Ocean Navy** (`ocean-navy`) | `#002B49` | Stability, trust, and container background headers. |
| **Coastal Teal** (`coastal-teal`) | `#009DAE` | Interactive elements, active states, and highlights. |
| **Bio-Green** (`bio-green`) | `#34C759` | Semantic indicators for positive states (Live, Success, Optimal). |
| **Deep Obsidian** (`deep-obsidian`) | `#121214` | Primary dark mode base background. |
| **Pure White** (`pure-white`) | `#FFFFFF` | Primary light mode card background surfaces. |
| **Background** (`background` / `surface`) | `#F9F9FE` | Light mode canvas background. |

### Color Mode Strategies
*   **Light Mode:** Background canvas uses `#F9F9FE` (surface) with `#FFFFFF` (Pure White) containers to create depth. Low-contrast borders (`#E5E5EA` or `#C3C7CE` / `outline-variant`) are used for ghost outlines.
*   **Dark Mode:** Background transitions to `#121214` (Deep Obsidian). Container surfaces elevate using slightly brighter grays.
*   **Semantic Indication:** `#34C759` (Bio-Green) is strictly reserved for success states, optimal telemetry readings, and "Live" status badges (paired with a low-opacity background block).

---

## 2. Spacing Rules & Layout Scale

An equal-width responsive grid system coordinates layout structure to ensure clean visual alignments and zero cognitive friction.

### Spacing Scale
| Name | Value | CSS Equivalent | Application |
| :--- | :--- | :--- | :--- |
| `stack-tight` | `8px` | `0.5rem` | Inner element gaps, tight label pairings. |
| `outer-padding` | `16px` | `1.0rem` | Main viewport margins, card padding. |
| `gutter` | `16px` | `1.0rem` | Grid spacing between modules/cards. |
| `container-gap` | `24px` | `1.5rem` | Vertical separation between main content sections. |
| `stack-loose` | `32px` | `2.0rem` | Generous layout spacing between major sections. |

### Grid Rules
*   **Grid Structure:** Core sectors (Water Quality, Spawning, Purchasing, Processing, HR) use an equal-width distribution model on desktop screens.
*   **Mobile Reflow:** Grid structures collapse automatically into a single-column vertical stack on mobile viewports.
*   **Padding Limits:** A mandatory minimum outer margin of `16px` (`1rem`) padding is maintained at the main window viewport edge.

---

## 3. Shapes & Border Radius

The visual language follows a cohesive, soft industrial geometric rhythm.

*   **Standard Border Radius:** A uniform **`8px`** (`0.5rem` or `rounded-lg`) border radius is mandatory for:
    *   Primary modules & dashboard cards
    *   Input fields
    *   Buttons & call-to-action triggers
    *   Status badges
*   **Tactile Consistency:** The 8px rounding creates a unified "instrument panel" block feel, making widgets look like high-grade modular components.
*   **Circular Contrast:** Circular shapes are prohibited for layout blocks and are strictly reserved for:
    *   User avatars
    *   Status indicator dots (e.g., Live pulse dots)

---

## 4. Typography

Typography is designed for rapid legibility and clean separation of qualitative labels and quantitative data.

*   **Primary Typeface:** **Inter** is used for main UI readability, titles, labels, and description content.
*   **Data Typeface:** **JetBrains Mono** is utilized forPIN pads, system status logs, clocks, and high-precision telemetry readings (e.g., pH, temperature, salinity) to facilitate column alignment.
*   **Bilingual Contrast:** Korean and English text are paired using a 2px difference (e.g., English primary labels at `14px`, Korean secondary labels at `12px`) to maintain primary language focus.

---

## 5. Components & Interactive States

### Buttons
*   **Primary Action:** Coastal Teal (`#009DAE`) background with white text.
*   **Terminal Keys:** 1:1 square ratio buttons with `8px` corner radius, using a neutral gray background.

### Module Cards (Hatchery/Ops Cards)
*   Must contain a leading icon inside a light teal/lavender tinted square.
*   Must feature bilingual labels (title + descriptive subtext).
*   A `Live` badge (Bio-Green text with 10% opacity Bio-Green background) is positioned in the top-right corner to indicate active data feeds.

### Input Fields
*   Understated boundaries with transparent backgrounds. Highlighted focus states feature a 2px Coastal Teal bottom border or a subtle outer glow.
