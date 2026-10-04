# Chakra

**Offline-first Small AI for smallholder coffee farmers in Peru.**
World Bank "Small AI for Development" hackathon, Agriculture sector.

> **Because of this tool**, a smallholder coffee farmer in Peru's highland forest will **check a sick leaf, this month's rust and borer weather risk, and a middleman's price offer on their own phone, without signal, before they spray or sell** that they would otherwise do with no technical advice at all.
> **We know because** Peru has 289,675 coffee producers (MIDAGRI 2024) and only 3.2% received technical assistance (INEI ENA 2023); the 2013 rust epidemic hit 133,000 ha (SENASA) and cut production by about 30%; 88.1% of rural households have a mobile phone but only 23.4% have internet (INEI ENAHO Q4 2025).

Chakra informs; the person decides. Every result shows its source and date, and every module says **"No estoy seguro, pregunta al técnico"** with a reason instead of guessing.

---

## What it does

| Screen | What the farmer gets | How |
|---|---|---|
| **Hoja** (leaf) | Photo of the leaf underside → healthy / rust / leaf miner / Phoma / Cercospora / ojo de gallo, or an explicit abstention | Photo-quality gate → MobileNetV3-Small ONNX on device → temperature scaling + energy + Mahalanobis OOD + split-conformal set. Answers only when the set is a single class. |
| **Clima** (weather) | Rust weather risk, days until lesions appear, narrow day/night range warning, borer degree-days and projected date | Open-Meteo history + 16-day forecast, altitude lapse-rate correction, published agronomic rules |
| **Precio** (price) | Is this offer below, inside or above a reference band for parchment coffee (S/ per kg and per 46 kg quintal)? | World Bank Pink Sheet Arabica × FX × observed Peru pass-through (FAOSTAT) |
| **Tarjeta** (card) | A ≤160-character ASCII code with all results for WhatsApp/SMS, plus a local outbox | Store-and-forward; nothing is sent automatically |
| **Acerca** (about) | Model card metrics, the localized-AI story, what is NOT covered, data licenses, privacy, citations | Read from `public/model/model_card.json` |

UI copy is in simple Spanish (default) with a **Quechua Chanka (quy) toggle**. The Quechua text is a **draft pending native-speaker review** (Ministerio de Cultura Chanka team). The "Escuchar" button uses the phone's offline Spanish voice (`speechSynthesis`). **There is no Quechua audio yet.** The next step is a pre-synthesized phrase bank made with MMS-TTS (`facebook/mms-tts-quy`).

## Localized AI

The base model is trained on BRACOL (Brazil). We then use **40 Peruvian leaves from Saposoa, San Martín** to adapt it, and test it on other Peruvian leaves it never saw. The Hoja screen states accuracy measured on those Peruvian leaves ("acierto ~X% en hojas de Perú", with the sample size), and shows BRACOL test metrics separately in Acerca. The same 40 local leaves taught the model **ojo de gallo** (*Mycena citricolor*), a disease common in Peru that is absent from the Brazilian data; that class is shown as provisional ("aprendido con 40 hojas de Saposoa, San Martín: resultado provisional"). Nutrient-deficiency leaves from Jaén (CoLeaf-DB) are kept as a never-seen test to measure abstention. For Chakra, localizing AI means a model from another country is not enough.

The class list is read from `model_card.json` (never hard-coded), so the app follows the model contract as it evolves.

## Architecture

```
src/
  core/            pure, unit-tested logic (no I/O)
    gates.js       softmax/T, energy, Mahalanobis, conformal set -> answer | abstain
    quality.js     brightness, Laplacian blur, leaf-pixel ratio -> retake advice
    tensor.js      RGBA -> CHW float32 [0,1] (normalization is inside the ONNX graph)
    modelCard.js   NaN-tolerant model card parser + summary (v1 and v2 formats)
    rules.js       ExpeRoya, incubation, diurnal range, borer degree-days, altitude, staleness
    weatherMerge.js Open-Meteo archive + forecast merge
    price.js       reference band, unit conversion, offer assessment, staleness
    card.js        SMS-safe evidence card, share links, outbox
  ai/classifier.js onnxruntime-web (WASM, self-hosted /ort/), lazy session, EXIF-aware squash resize
  data/            Open-Meteo fetch + cache, prices + live FX, demo farms, safe localStorage
  i18n/            es.js, quy.js (draft), citations
  pages/           Home, Hoja, Clima, Precio, Tarjeta, Acerca
public/
  model/           chakra.onnx, model_card.json, ood.json (written by ml/)
  data/            prices.json, weather/<farm>.json snapshots
  ort/             copied from node_modules at install/build (git-ignored)
scripts/           copy-ort.mjs, snapshot-weather.mjs, make-icons.mjs
```

Decision logic (`src/core/gates.js`, mirrors the Python calibration exactly):

```
p = softmax(z / T);  energy = -T * logsumexp(z / T)
maha = min_c (g - mu_c)^T P (g - mu_c),  g = W (f - mean)
if energy > energy_threshold or maha > mahalanobis_threshold -> abstain "unfamiliar"
set = { k : p_k >= 1 - qhat }
|set| > 1 -> abstain "ambiguous" (lists candidates);  |set| = 0 -> abstain "unfamiliar"
else answer argmax
```

If `ood.json` is missing, the Mahalanobis gate is skipped and Acerca says so.

## Small AI constraints

| Constraint | Chakra |
|---|---|
| Model size | ~6 MB fp32 MobileNetV3-Small ONNX (int8 was tested and rejected after a large accuracy drop) |
| Runs on | Any recent Android browser; WASM, 1 thread, no GPU |
| Network | None needed after the first load; the service worker precaches app, runtime, model and data (~20 MB) |
| Side-loadable | Static files only; copy `dist/` to any host or a local server |
| No cloud AI | No LLM, no RAG, no API keys; weather and FX refresh are optional |
| Privacy | Photos never leave the phone; no account; no tracking; GPS rounded to 2 decimals and never sent to our servers |
| Human in the loop | Advice never prescribes doses and always ends with "Confirma con un técnico" |

## Data

| Data | Use | License |
|---|---|---|
| BRACOL leaf images (Esgario et al. 2020) | Training / test | CC BY 4.0 |
| CoLeaf-DB nutrient-deficiency leaves, Jaén, Peru | Never-seen abstention test only | See dataset terms |
| Saposoa leaves, San Martín, Peru (Santa-María & Rodríguez 2026) | Local adaptation + Peru test | CC BY 4.0 |
| Open-Meteo (ERA5 archive + forecast) | Weather rules; snapshots in `public/data/weather/` | CC BY 4.0 |
| World Bank Commodity Prices (Pink Sheet) | Arabica USD/kg | CC BY 4.0 |
| FAOSTAT Producer Prices, Peru | Farmgate pass-through band (0.51–0.58) | CC BY 4.0 |
| open.er-api.com | Optional live USD→PEN | Free with attribution |

**Not covered:** nutrient deficiencies (N, Fe, K…), coffee berry borer damage and any berry/stem/root symptom, the upper leaf surface, leaves on the plant against cluttered backgrounds, multiple simultaneous stresses, night/flash photos, product doses, exact prices, yield forecasts.

## Guardrails

- **Photo quality gate** before the model: brightness 40–220, variance of Laplacian ≥ 60, leaf-pixel ratio ≥ 0.15, with specific retake advice.
- **Abstention everywhere:** leaf (unfamiliar / ambiguous / no model), weather (fewer than 25 valid days, or newest observation older than 3 days), price (no offer, implausible unit, reference older than 12 months).
- **Demo data is labelled:** bundled weather snapshots show "Datos de demostración del <fecha>".
- **Every number has a source and a date.** Combined rust risk (HIGH/MEDIUM/LOW) is marked as Chakra's own heuristic, not the paper's.
- **Nothing is sent automatically.** The person chooses when and to whom to send the card.

Weather rules: ExpeRoya monthly classes (Motisi et al. 2022); incubation period, sun and shade equations (Moraes et al. 1976 via Alfonsi et al. 2019), clamped to 15–60 days, under 19 days flagged; narrow diurnal range (Avelino et al. 2015), 30 days vs. the previous 60, at least 1.0 °C drop; borer degree-days, base 14.9 °C and cap 32 °C, 332 DD per generation (Jaramillo et al. 2009; Hamilton et al. 2019), Cenicafé 5% action threshold; altitude correction of 0.6 °C per 100 m.

## How to run

```bash
npm install          # also copies the ONNX Runtime WASM into public/ort/
npm run dev          # http://localhost:5173
npm test             # vitest, pure core modules
npm run build        # production build + service worker in dist/
npm run preview      # serve dist/ (service worker active)

npm run snapshot:weather   # refresh demo weather snapshots (network)
npm run icons              # regenerate PWA icons (sharp)
```

`vercel.json` provides the SPA rewrite and long cache headers for `/model`, `/ort` and `/assets`.

## Credits and references

Esgario, Krohling & Ventura 2020 (BRACOL); Santa-María & Rodríguez 2026 (Saposoa dataset); CoLeaf-DB; Avelino et al. 2007 (ojo de gallo); Motisi et al. 2022; Moraes et al. 1976 / Alfonsi et al. 2019; Avelino et al. 2015; Jaramillo et al. 2009; Hamilton et al. 2019; Sentelhas et al. 2008; Liu et al. 2020 (energy OOD); Lee et al. 2018 (Mahalanobis OOD); Angelopoulos & Bates 2021 (conformal prediction); Guo et al. 2017 (temperature scaling). Weather by Open-Meteo. Prices by the World Bank and FAOSTAT. Icons by Lucide. Fonts: Atkinson Hyperlegible (Braille Institute) and Fraunces.
