# 📦 Dataset Information

This project uses **no locally stored data files**. All data is downloaded at runtime directly from public NASA APIs.

---

## Data Sources

### 1. NASA Exoplanet Archive — KOI Cumulative Catalog
**What it is:** The labeled dataset. Contains all Kepler Objects of Interest (KOIs) with their dispositions (CONFIRMED, FALSE POSITIVE, CANDIDATE) and orbital parameters.

| Field | Details |
|---|---|
| **URL** | https://exoplanetarchive.ipac.caltech.edu |
| **Direct API** | https://exoplanetarchive.ipac.caltech.edu/cgi-bin/nstedAPI/nph-nstedAPI?table=cumulative&format=csv |
| **Format** | CSV (downloaded at runtime via pandas) |
| **Size** | ~9,500 KOI entries total |
| **Used** | CONFIRMED (class 1) and FALSE POSITIVE (class 0) entries only |
| **Sampled** | 200 confirmed + 200 false positives = 400 total (balanced) |
| **License** | Public domain — NASA open data |

**Key columns used:**
- `kepid` — Kepler star ID (used to fetch light curve)
- `koi_disposition` — label: CONFIRMED / FALSE POSITIVE
- `koi_period` — orbital period in days (used for phase-folding)
- `koi_time0bk` — transit epoch (used for phase-folding)
- `koi_duration` — transit duration in hours

---

### 2. MAST — Kepler Light Curves
**What it is:** The raw flux measurements. Downloaded star-by-star at runtime via the `lightkurve` Python library.

| Field | Details |
|---|---|
| **URL** | https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html |
| **Access** | Via `lightkurve` library (`lk.search_lightcurve()`) |
| **Format** | FITS files → converted to numpy arrays |
| **Cadence** | Long cadence (30-minute intervals) |
| **License** | Public domain — STScI open data |

---

## Data Pipeline

Each raw light curve goes through this processing pipeline before entering the model:

```
Raw FITS light curve (MAST)
        ↓
Flatten stellar variability (Savitzky-Golay filter, window=101)
        ↓
Phase-fold at transit period (align transit dips to centre)
        ↓
Bin to 201 fixed points
        ↓
Normalise: (flux - median) / std
        ↓
Quality filters:
  ✓ Download succeeded
  ✓ NaN fraction < 10%
  ✓ Signal std > 1e-4 (not flat/dead)
  ✓ Remaining NaNs filled with 0
        ↓
Final array shape: (201,) — ready for model input
```

---

## Why No Data Files Are Stored Here

The full Kepler dataset on MAST is ~3.5 TB. Storing even a subset locally is unnecessary since:
- NASA's API is free, public, and stable
- `lightkurve` handles authentication and caching automatically
- The notebook downloads only the ~400 stars needed for training

To reproduce the dataset, simply run the notebook from Step 2 onwards.
