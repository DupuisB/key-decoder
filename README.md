<img src="assets/icon.svg" width="56" height="56" alt="Key Decoder Icon">

# Key Decoder

A **100% client-side, offline-capable** web application for visually decoding physical pin-tumbler keys from a photograph and exporting print-ready, **watertight 3D binary `.stl` files**.

> **Privacy First:** Every step—photo rendering, two-anchor alignment, DSD bitting calculation, 3D WebGL preview, and binary `.stl` generation—executes exclusively in your browser's local memory. Zero uploads, zero servers, zero telemetry.

---

## Core Features

- **Shape-First Visual Overlay Alignment:**
  - Drag-and-drop or upload any key photo, or click **Load Sample Key** for instant offline testing.
  - Drag **Anchor A (Shoulder Stop)** and **Anchor B (Blade Tip)** to automatically compute rotation angle and exact millimeter-to-pixel scale.
  - Fine-tune alignment with `±0.5°` rotation nudges, `±0.5%` scale nudges, optional **Anchor C (Blade Width & Perspective Skew)**, horizontal/vertical flips, pan/zoom, and brightness/contrast filters.
- **Factory-Locked Cut Steppers & Live Silhouette:**
  - Real-time 60fps vector silhouette overlay with pin centerlines and factory depth tick ladders.
  - Tactile `+` / `-` steppers and discrete sliders locked to verified locksmith DSD root depths, plus live MACS (Maximum Adjacent Cut Specification) validation, one-click bitting copy, and local URL-hash state (`#keyway=WR5&cuts=1-5-2-7-6`).
- **Procedural Watertight 3D Manifold `.stl` Exporter:**
  - Interactive Three.js WebGL preview showing milled warding grooves, rounded bow with keyring hole, shoulder stops, bitting cuts, and tip bevel.
  - Configurable FDM print tolerances (`90%–105%` blade thickness scale, optional reinforced bow keeping `Z = 0` flat on the build plate for support-free printing).
  - Exports valid IEEE-754 binary `.stl` files named `<keyway>-<bitting>.stl` (e.g. `WR5-15276.stl`).

---

## Supported Keyway Standards (Verified Locksmith DSD)

| Keyway | Manufacturer | Pins | Depth Scale | 1st Cut | Pin Spacing | Depth Step | Root Depth (Shallow→Deep) | MACS | Ilco / DSD Ref |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **WR5** | Weiser | 5 | `0–9` | `0.237"` | `0.156"` | `0.018"` | `0.315"` → `0.153"` | 6 | `1054WB` / HPC C50 |
| **WR3** | Weiser | 5 | `0–9` | `0.237"` | `0.156"` | `0.018"` | `0.315"` → `0.153"` | 6 | `1054WB` / DSD #65 |
| **KW1** | Kwikset | 5 | `1–6` | `0.247"` | `0.150"` | `0.023"` | `0.329"` → `0.214"` | 4 | `1176` / HPC C18 |
| **KW10** | Kwikset | 6 | `1–6` | `0.247"` | `0.150"` | `0.023"` | `0.329"` → `0.214"` | 4 | `1176-6` / HPC C18 |
| **SC1** | Schlage | 5 | `0–9` | `0.231"` | `0.1562"` | `0.015"` | `0.335"` → `0.200"` | 7 | `1145` / HPC C45 |
| **SC4** | Schlage | 6 | `0–9` | `0.231"` | `0.1562"` | `0.015"` | `0.335"` → `0.200"` | 7 | `1145A` / HPC C45 |
| **Y1** | Yale | 5 | `0–9` | `0.200"` | `0.165"` | `0.019"` | `0.320"` → `0.149"` | 5 | `999` / HPC C57 |
| **Y2** | Yale | 6 | `0–9` | `0.200"` | `0.165"` | `0.019"` | `0.320"` → `0.149"` | 5 | `999A` / HPC C57 |
| **M1** | Master Lock | 4 | `0–7` | `0.187"` | `0.125"` | `0.0155"` | `0.272"` → `0.1635"` | 5 | `1092` / Master 1K |
| **M10** | Master Lock | 5 | `0–7` | `0.187"` | `0.125"` | `0.0155"` | `0.272"` → `0.1635"` | 5 | `1092N` / Master 15K |
| **LA-5** | Sargent | 5 | `0–9` | `0.216"` | `0.156"` | `0.020"` | `0.330"` → `0.150"` | 7 | `1007LA-5` / HPC C36 |
| **LA-6** | Sargent | 6 | `0–9` | `0.216"` | `0.156"` | `0.020"` | `0.330"` → `0.150"` | 7 | `1007LA` / HPC C36 |
| **AR1** | Arrow | 5 | `0–9` | `0.265"` | `0.155"` | `0.015"` | `0.325"` → `0.190"` | 6 | `1179` / HPC C3 |
| **Custom** | User Defined | `2+` | Custom | Custom | Custom | Custom | `mm` or `in` arrays | Custom | Collapsible panel |

---

## Local Development & Verification

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Typecheck (TypeScript strict mode)
npm run typecheck

# Run unit tests (DSD specs + binary STL watertightness & dimensional audit)
npm test

# Build production static bundle (dist/)
npm run build

# Run Playwright end-to-end tests (downloads & audits live STL in Chromium)
npm run test:e2e
```

---

## 3D Printing Advisory

- **Orientation:** Exported `.stl` models sit flat on `Z = 0` for support-free printing.
- **Slicer Settings:** Use **100% infill** (or all walls/perimeters) and **0.12–0.16 mm** layer height.
- **Material:** PLA+, PETG, or Nylon recommended; avoid brittle matte PLA.
- **Tolerance:** Start at **98% blade thickness scale** for standard 0.4 mm FDM nozzles.
- **Safety:** 3D-printed plastic keys are intended for emergency backup and test-fitting only—do not force in stiff or corroded cylinders.

---

## Deploying to GitHub Pages

This repository includes `.github/workflows/deploy.yml` configured with Vite's relative `base: './'` so it works cleanly on any repository subpath (`https://<user>.github.io/<repo>/`).

1. Push the repository to GitHub with `main` as the default branch.
2. Open **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Push any commit to `main` (or manually trigger the workflow in the **Actions** tab). GitHub Actions will typecheck, run Vitest, build `dist/`, and publish automatically.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for module boundaries, coordinate conventions, and the mathematical proof of the watertight genus-1 manifold mesh generator.
