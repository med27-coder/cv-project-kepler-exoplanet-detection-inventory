"""Draw the README chart comparing test metrics across project versions (V1 -> V3).

    .venv\\Scripts\\python scripts\\plot_version_progress.py

V1 and V1.5 numbers come from the original Colab runs (no metrics file survives);
V2 and V3 are read from results/v2/metrics.json and results/v3/metrics.json
(results/v3 exists after training or `secure_artifacts.py unlock`).
Writes results/version_progress.png and results/version_progress_dark.png
(the README picks one by the reader's GitHub theme).
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use('Agg')
import matplotlib.patheffects as pe
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'results'

# Test-set metrics at the 0.5 threshold, plus the number of usable light curves.
COLAB_RUNS = {
    'V1': dict(accuracy=0.5938, auc=0.573, precision=0.5957, recall=0.8000, n_curves=320),
    'V1.5': dict(accuracy=0.7044, auc=0.771, precision=0.7273, recall=0.7356, n_curves=794),
}
TARGETS = {'percent': 80, 'auc': 0.85}

THEMES = {
    'light': dict(surface='#fcfcfb', ink='#0b0b0b', ink2='#52514e', muted='#898781', grid='#e1e0d9',
                  axis='#c3c2b7', series=['#2a78d6', '#eb6834', '#1baf7a']),
    'dark': dict(surface='#1a1a19', ink='#ffffff', ink2='#c3c2b7', muted='#898781', grid='#2c2c2a',
                 axis='#383835', series=['#3987e5', '#d95926', '#199e70']),
}


def load_versions():
    versions = dict(COLAB_RUNS)
    v2 = json.loads((ROOT / 'results/v2/metrics.json').read_text())
    versions['V2'] = {k: v2[k] for k in ('accuracy', 'auc', 'precision', 'recall')} | {'n_curves': 3576}
    v3_file = ROOT / 'results/v3/metrics.json'
    if not v3_file.exists():
        sys.exit('results/v3/metrics.json not found: train V3 or run "secure_artifacts.py unlock" first.')
    v3 = json.loads(v3_file.read_text())
    m = v3['results']['hybrid']['threshold_0.5']
    versions['V3'] = {k: m[k] for k in ('accuracy', 'auc', 'precision', 'recall')} | {'n_curves': v3['n_kois']}
    return versions


def style_axes(ax, t):
    ax.set_facecolor(t['surface'])
    for side in ('top', 'right', 'left'):
        ax.spines[side].set_visible(False)
    ax.spines['bottom'].set_color(t['axis'])
    ax.tick_params(colors=t['muted'], length=0, labelsize=9)
    ax.grid(axis='y', color=t['grid'], linewidth=0.8)
    ax.set_axisbelow(True)


def target_line(ax, y, label, t):
    ax.axhline(y, color=t['ink2'], linewidth=1, linestyle=(0, (4, 3)), zorder=1)
    ax.text(0.99, y, label, transform=ax.get_yaxis_transform(), va='bottom', ha='right',
            fontsize=8.5, color=t['ink2'])


def value_label(ax, text, xy, dy, t):
    """Direct label with a surface-colored halo so it stays legible over lines."""
    ax.annotate(text, xy, textcoords='offset points', xytext=(0, dy), ha='center', fontsize=8.5,
                color=t['ink'], zorder=4, path_effects=[pe.withStroke(linewidth=3, foreground=t['surface'])])


def draw(versions, theme, path):
    t = THEMES[theme]
    names = list(versions)
    x = range(len(names))
    plt.rcParams['font.family'] = ['Segoe UI', 'DejaVu Sans']
    fig, axes = plt.subplots(1, 3, figsize=(13, 4.3), gridspec_kw={'width_ratios': [1.35, 1, 1]})
    fig.patch.set_facecolor(t['surface'])

    # 1) accuracy / precision / recall (percent)
    ax = axes[0]
    style_axes(ax, t)
    for (key, label), color in zip([('accuracy', 'Accuracy'), ('precision', 'Precision'),
                                    ('recall', 'Recall')], t['series']):
        ys = [versions[n][key] * 100 for n in names]
        ax.plot(x, ys, color=color, linewidth=2, marker='o', markersize=7, label=label,
                markeredgecolor=t['surface'], markeredgewidth=1.5, zorder=3)
    acc = [versions[n]['accuracy'] * 100 for n in names]
    for i, v in enumerate(acc):
        value_label(ax, f'{v:.1f}%', (i, v), -26 if i else -16, t)
    target_line(ax, TARGETS['percent'], 'target 80%', t)
    ax.set_ylim(50, 100)
    ax.set_title('Accuracy, precision and recall (%)', loc='left', fontsize=11, color=t['ink'])
    leg = ax.legend(loc='upper left', frameon=False, fontsize=9, ncol=3)
    for txt in leg.get_texts():
        txt.set_color(t['ink2'])

    # 2) AUC
    ax = axes[1]
    style_axes(ax, t)
    auc = [versions[n]['auc'] for n in names]
    ax.plot(x, auc, color=t['series'][0], linewidth=2, marker='o', markersize=7,
            markeredgecolor=t['surface'], markeredgewidth=1.5, zorder=3)
    for i, v in enumerate(auc):
        value_label(ax, f'{v:.3f}', (i, v), 9, t)
    target_line(ax, TARGETS['auc'], 'target 0.85', t)
    ax.set_ylim(0.5, 1.03)
    ax.set_title('ROC AUC', loc='left', fontsize=11, color=t['ink'])

    # 3) dataset size
    ax = axes[2]
    style_axes(ax, t)
    sizes = [versions[n]['n_curves'] for n in names]
    ax.bar(x, sizes, width=0.6, color=t['series'][0], zorder=2)
    for i, v in enumerate(sizes):
        value_label(ax, f'{v:,}', (i, v), 4, t)
    ax.set_ylim(0, max(sizes) * 1.15)
    ax.set_title('Usable light curves (KOIs)', loc='left', fontsize=11, color=t['ink'])
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))

    for ax in axes:
        ax.set_xticks(list(x), names)
        ax.set_xlim(-0.5, len(names) - 0.5)
        for lbl in ax.get_xticklabels():
            lbl.set_color(t['ink2'])
            lbl.set_fontsize(10)
    fig.suptitle('Test-set results by project version (threshold 0.5)', x=0.01, ha='left',
                 fontsize=13, fontweight='bold', color=t['ink'])
    fig.tight_layout(rect=(0, 0, 1, 0.95), w_pad=2.5)
    fig.savefig(path, dpi=150, facecolor=t['surface'])
    plt.close(fig)


def main():
    versions = load_versions()
    for theme, name in (('light', 'version_progress.png'), ('dark', 'version_progress_dark.png')):
        draw(versions, theme, OUT / name)
        print(f'Saved results/{name}')


if __name__ == '__main__':
    main()
