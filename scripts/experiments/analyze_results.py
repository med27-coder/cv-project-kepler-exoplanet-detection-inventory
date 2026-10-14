"""Where does Star Gazer succeed and fail? Error analysis of the V3 test set + the candidate scores.

    .venv\\Scripts\\python scripts\\experiments\\analyze_results.py

Reads the saved test predictions (results/v3/test_predictions.npz: 1,517 KOIs on held-out stars),
the KOI catalog and the candidate scores, and breaks performance down by planet size, signal
strength, orbital period, star brightness and planets per star. Each slice gets accuracy, recall
(share of real planets found), false-positive rate and a 95% interval, so small slices aren't
over-read. Writes results/v3_public/analysis.json and two charts (public: numbers only, no model).
No training; runs in seconds.
"""

import json
import sys

import numpy as np
import pandas as pd

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S

PREDICTIONS = S.RESULTS_DIR / 'test_predictions.npz'
CANDIDATES = S.RESULTS_DIR / 'candidates.csv'
OUT = C.PROJECT_ROOT / 'results' / 'v3_public'
SLICES = {   # column, bin edges, labels
    'planet radius (Earths)': ('koi_prad', [0, 1.5, 4, 8, 15, np.inf], ['< 1.5', '1.5–4', '4–8', '8–15', '> 15']),
    'signal strength (SNR)': ('koi_model_snr', [0, 10, 20, 50, 200, np.inf], ['< 10', '10–20', '20–50', '50–200', '> 200']),
    'orbital period (days)': ('koi_period', [0, 3, 10, 30, 100, np.inf], ['< 3', '3–10', '10–30', '30–100', '> 100']),
    'star brightness (Kepler mag)': ('koi_kepmag', [0, 13, 14, 15, 16, np.inf], ['< 13', '13–14', '14–15', '15–16', '> 16']),
    'KOIs on the star': ('koi_count', [0, 1, 2, 4, np.inf], ['1', '2', '3–4', '5+']),
}


def wilson(k, n, z=1.96):
    """95% Wilson interval for a proportion k/n (good for small slices)."""
    if n == 0:
        return (np.nan, np.nan)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (round(c - h, 4), round(c + h, 4))


def slice_stats(y, pred):
    """Accuracy, recall and false-positive rate (with intervals) for one slice."""
    n, correct = len(y), int((y == pred).sum())
    pos, neg = y == 1, y == 0
    found, false_alarms = int((pred[pos] == 1).sum()), int((pred[neg] == 1).sum())
    return {'n': n, 'planets': int(pos.sum()),
            'accuracy': round(correct / n, 4) if n else None, 'accuracy_ci': wilson(correct, n),
            'recall': round(found / pos.sum(), 4) if pos.sum() else None, 'recall_ci': wilson(found, int(pos.sum())),
            'false_positive_rate': round(false_alarms / neg.sum(), 4) if neg.sum() else None}


def breakdown(table, y, pred):
    out = {}
    for title, (col, edges, labels) in SLICES.items():
        bins = pd.cut(table[col], edges, labels=labels)   # right-closed: (0, 1] is '1', (1, 2] is '2', ...)
        out[title] = {str(lab): slice_stats(y[(bins == lab).to_numpy()], pred[(bins == lab).to_numpy()])
                      for lab in labels}
    return out


def chart(results, path, keys):
    """Accuracy and recall per slice, with 95% intervals, for a few slicings side by side."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    blue, orange, ink, grid = '#2a78d6', '#eb6834', '#3a3a38', '#e1e0d9'
    fig, axes = plt.subplots(1, len(keys), figsize=(5.2 * len(keys), 4.2), sharey=True)
    for ax, key in zip(np.atleast_1d(axes), keys):
        rows = results[key]
        labels = list(rows)
        x = np.arange(len(labels))
        for off, metric, color, name in ((-0.18, 'accuracy', blue, 'Accuracy'), (0.18, 'recall', orange, 'Recall (planets found)')):
            vals = np.array([np.nan if rows[k][metric] is None else rows[k][metric] for k in labels]) * 100
            ci = np.array([rows[k][f'{metric}_ci'] for k in labels], dtype=float) * 100
            err = np.vstack([vals - ci[:, 0], ci[:, 1] - vals])
            ax.bar(x + off, vals, 0.34, color=color, label=name, yerr=err, capsize=3, ecolor=ink, error_kw={'lw': 1})
            for xi, v in zip(x + off, vals):   # label the weak spots so they can't be missed
                if np.isfinite(v) and v < 90:
                    ax.text(xi, v + 2, f'{v:.0f}%', ha='center', va='bottom', fontsize=8, color=ink)
        ax.set_xticks(x, [f'{k}\n(n={rows[k]["n"]})' for k in labels], fontsize=8, color=ink)
        ax.set_title(key, fontsize=11, color=ink)
        ax.set_ylim(0, 108)   # bars start at zero
        ax.grid(axis='y', color=grid)
        ax.set_axisbelow(True)
        for s in ('top', 'right'):
            ax.spines[s].set_visible(False)
    np.atleast_1d(axes)[0].set_ylabel('% (test set, threshold 0.5)', color=ink)
    fig.legend(*np.atleast_1d(axes)[0].get_legend_handles_labels(), frameon=False, fontsize=9, ncol=2,
               loc='upper right', bbox_to_anchor=(0.99, 0.995))
    fig.suptitle('Where Star Gazer V3 succeeds and fails (whiskers: 95% intervals)', fontsize=12, color=ink, x=0.02, ha='left')
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def candidates_summary(cand, threshold):
    p, nasa = cand['star_gazer_prob'], cand['koi_score']
    both = nasa.notna()
    return {'n': len(cand), 'above_threshold': int((p >= threshold).sum()),
            'share_above': round(float((p >= threshold).mean()), 4),
            'confident_planet_(>=0.9)': int((p >= 0.9).sum()), 'confident_false_positive_(<0.1)': int((p < 0.1).sum()),
            'uncertain_(0.3-0.7)': int(((p >= 0.3) & (p < 0.7)).sum()),
            'agree_with_nasa_score': round(float(((p[both] >= threshold) == (nasa[both] >= 0.5)).mean()), 4),
            'correlation_with_nasa_score': round(float(p[both].corr(nasa[both])), 3),
            'median_radius_called_planet': round(float(cand.loc[p >= threshold, 'koi_prad'].median()), 2),
            'median_radius_called_false_positive': round(float(cand.loc[p < threshold, 'koi_prad'].median()), 2)}


def main():
    if not PREDICTIONS.exists():
        sys.exit(f'{C.rel(PREDICTIONS)} not found: train (scripts/pipeline/train_star_gazer.py) or unlock '
                 '(scripts/tools/secure_artifacts.py unlock) first.')
    with np.load(PREDICTIONS, allow_pickle=False) as z:
        names, prob, y = z['names'].astype(str), z['prob'], z['y'].astype(int)
    cat = S.load_catalog().set_index('kepoi_name')
    table = cat.loc[names].reset_index()
    pred = (prob >= 0.5).astype(int)
    results = {'overall': slice_stats(y, pred), 'slices': breakdown(table, y, pred)}
    wrong = np.argsort(-np.abs(prob - y))[:10]
    results['most_confident_mistakes'] = [
        {'koi': names[i], 'truth': 'planet' if y[i] else 'false positive', 'p_planet': round(float(prob[i]), 4),
         'radius': None if pd.isna(table.koi_prad[i]) else round(float(table.koi_prad[i]), 2),
         'snr': None if pd.isna(table.koi_model_snr[i]) else round(float(table.koi_model_snr[i]), 1)}
        for i in wrong if (prob[i] >= 0.5) != y[i]]
    if CANDIDATES.exists():
        threshold = json.loads(S.THRESHOLD_FILE.read_text())['threshold'] if S.THRESHOLD_FILE.exists() else 0.5
        results['candidates'] = candidates_summary(pd.read_csv(CANDIDATES), threshold)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'analysis.json').write_text(json.dumps(results, indent=2, default=float), encoding='utf-8')
    keys = list(SLICES)
    chart(results['slices'], OUT / 'analysis_size_signal.png', keys[:2])
    chart(results['slices'], OUT / 'analysis_period_star.png', keys[2:])
    print(f"Overall: accuracy {results['overall']['accuracy']:.4f}, recall {results['overall']['recall']:.4f} "
          f"(n={results['overall']['n']}). Saved {C.rel(OUT / 'analysis.json')} and 2 charts.")


if __name__ == '__main__':
    main()
