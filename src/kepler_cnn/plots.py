"""Figures for the notebooks. V2 figures save into results/v2/; V3 figures take a `path`."""

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import auc, confusion_matrix, precision_recall_curve, roc_curve

from . import config as C

PHASE = np.linspace(-0.5, 0.5, C.BINS)


def _save(fig, name):
    C.ensure_dirs()
    if name:
        fig.savefig(C.RESULTS_DIR / name, bbox_inches='tight', dpi=120)
    return fig


def _color(label):
    return C.PLANET_COLOR if label == 1 else C.FP_COLOR


def draw_curve(ax, flux, color, title=None):
    flux = np.asarray(flux).flatten()
    ax.plot(PHASE, flux, color=color, linewidth=1.2)
    ax.fill_between(PHASE, flux, alpha=0.15, color=color)
    ax.axhline(0, color='gray', linestyle='--', linewidth=0.7, alpha=0.5)
    ax.set_xlim(-0.5, 0.5)
    ax.set_xlabel('Phase')
    ax.set_ylabel('Normalized Flux')
    if title:
        ax.set_title(title, fontsize=10, color=color)


def physical_properties(df_dataset, name='koi_physical_properties.png'):
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    fig.suptitle('Physical Properties: Confirmed Planets vs. False Positives',
                 fontsize=16, fontweight='bold', y=1.05)
    features = [('koi_period', 'Orbital Period (Days)'),
                ('koi_duration', 'Transit Duration (Hours)'),
                ('koi_depth', 'Transit Depth (ppm)')]
    df = df_dataset.assign(Disposition=df_dataset['label'].map({1: 'Planet', 0: 'False Positive'}))
    for ax, (feat, title) in zip(axes, features):
        sns.histplot(data=df[df[feat] > 0], x=feat, hue='Disposition',
                     palette={'Planet': C.PLANET_COLOR, 'False Positive': C.FP_COLOR},
                     element='step', stat='density', common_norm=False,
                     log_scale=True, bins=30, alpha=0.5, ax=ax)
        ax.set_title(title)
        ax.set_xlabel(title + ' (log scale)')
    plt.tight_layout()
    return _save(fig, name)


def example_curves(examples, name='lightcurve_examples.png'):
    """examples: list of (title, label, flux-or-None)."""
    fig, axes = plt.subplots(2, 2, figsize=(14, 7))
    fig.suptitle('Kepler Phase-Folded Light Curves', fontsize=14, fontweight='bold')
    for ax, (title, label, flux) in zip(axes.flat, examples):
        if flux is None:
            ax.text(0.5, 0.5, 'Download failed', ha='center', va='center',
                    transform=ax.transAxes, color='gray')
            ax.set_title(title, fontsize=10)
        else:
            draw_curve(ax, flux, _color(label), title)
    plt.tight_layout()
    return _save(fig, name)


def class_balance(y, name='class_balance_pie.png'):
    fig, ax = plt.subplots(figsize=(6, 6))
    planets = int(np.sum(y))
    ax.pie([planets, len(y) - planets], labels=['Confirmed Planets', 'False Positives'],
           colors=[C.PLANET_COLOR, C.FP_COLOR], autopct='%1.1f%%', startangle=140,
           wedgeprops={'edgecolor': 'white', 'linewidth': 2},
           textprops={'fontsize': 12, 'fontweight': 'bold'})
    ax.set_title(f'Training Data Class Balance (n={len(y)})', fontsize=14, fontweight='bold')
    return _save(fig, name)


def training_history(hist, name='training_history.png'):
    fig, axes = plt.subplots(1, 3, figsize=(17, 5))
    fig.suptitle('Training History', fontsize=14, fontweight='bold')
    for ax, metric, title in zip(axes, ['loss', 'accuracy', 'auc'], ['Loss', 'Accuracy', 'AUC']):
        ax.plot(hist[metric], label='Train', linewidth=2)
        ax.plot(hist[f'val_{metric}'], label='Val', linewidth=2, linestyle='--')
        ax.set_title(title)
        ax.set_xlabel('Epoch')
        ax.legend()
        ax.grid(True, alpha=0.3)
    plt.tight_layout()
    return _save(fig, name)


def prediction_grid(X, y_true, y_prob, y_pred, title, name):
    """Up to 4 correct + 4 wrong predictions, border coloured by correctness."""
    correct_idx = np.where(y_pred == y_true)[0][:4]
    wrong_idx = np.where(y_pred != y_true)[0][:4]
    fig, axes = plt.subplots(2, 4, figsize=(18, 8))
    fig.suptitle(title, fontsize=14, fontweight='bold')
    for ax in axes.flat:
        ax.set_visible(False)
    for ax, idx in zip(axes.flat, list(correct_idx) + list(wrong_idx)):
        ax.set_visible(True)
        correct = y_pred[idx] == y_true[idx]
        border = C.CORRECT_COLOR if correct else C.WRONG_COLOR
        draw_curve(ax, X[idx], _color(y_true[idx]))
        for spine in ax.spines.values():
            spine.set_edgecolor(border)
            spine.set_linewidth(2.5)
        true_lbl = 'Planet' if y_true[idx] == 1 else 'False Pos'
        pred_lbl = 'Planet' if y_pred[idx] == 1 else 'False Pos'
        ax.set_title(f'True: {true_lbl} | Pred: {pred_lbl} ({y_prob[idx]:.1%})\n'
                     f'{"CORRECT" if correct else "WRONG"}', fontsize=9, color=border)
    plt.tight_layout()
    return _save(fig, name)


def evaluation(y_true, y_prob, y_pred, name='evaluation_plots.png'):
    fig, axes = plt.subplots(1, 3, figsize=(17, 5))
    fig.suptitle('Model Evaluation', fontsize=14, fontweight='bold')

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[0],
                xticklabels=['False Pos', 'Planet'], yticklabels=['False Pos', 'Planet'])
    axes[0].set_title('Confusion Matrix')
    axes[0].set_ylabel('True Label')
    axes[0].set_xlabel('Predicted Label')

    fpr, tpr, _ = roc_curve(y_true, y_prob)
    axes[1].plot(fpr, tpr, color=C.PLANET_COLOR, lw=2, label=f'AUC = {auc(fpr, tpr):.3f}')
    axes[1].plot([0, 1], [0, 1], color='gray', linestyle='--', lw=1)
    axes[1].fill_between(fpr, tpr, alpha=0.1, color=C.PLANET_COLOR)
    axes[1].set(xlabel='False Positive Rate', ylabel='True Positive Rate', title='ROC Curve')

    prec, rec, _ = precision_recall_curve(y_true, y_prob)
    axes[2].plot(rec, prec, color=C.CORRECT_COLOR, lw=2, label=f'PR AUC = {auc(rec, prec):.3f}')
    axes[2].fill_between(rec, prec, alpha=0.1, color=C.CORRECT_COLOR)
    axes[2].set(xlabel='Recall', ylabel='Precision', title='Precision-Recall Curve')

    for ax in axes[1:]:
        ax.legend()
        ax.grid(True, alpha=0.3)
    plt.tight_layout()
    return _save(fig, name)


def train_test_comparison(hist, test_metrics, name='training_test_comparison.png'):
    fig, axes = plt.subplots(1, 3, figsize=(17, 5))
    fig.suptitle('Training vs. Test Performance', fontsize=14, fontweight='bold')
    for ax, metric, title in zip(axes, ['accuracy', 'auc', 'loss'], ['Accuracy', 'AUC', 'Loss']):
        ax.plot(hist[metric], label='Train', linewidth=2)
        ax.plot(hist[f'val_{metric}'], label='Validation', linewidth=2, linestyle='--')
        ax.axhline(test_metrics[metric], color='green', linestyle=':', linewidth=2,
                   label=f'Test ({test_metrics[metric]:.3f})')
        ax.set(title=title, xlabel='Epoch', ylabel=title)
        ax.legend()
        ax.grid(True, alpha=0.3)
    plt.tight_layout()
    return _save(fig, name)


def single_prediction(flux, prob, verdict, title):
    color = C.PLANET_COLOR if verdict == 'PLANET' else C.FP_COLOR
    fig, ax = plt.subplots(figsize=(10, 4))
    draw_curve(ax, flux, color)
    ax.set_title(f'{title}  |  P(planet) = {prob:.1%}  ->  {verdict}',
                 fontsize=12, fontweight='bold', color=color)
    plt.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# V3 Star Gazer figures. Each takes an optional `path`; the figure is saved there if given.
# ---------------------------------------------------------------------------
ODD_COLOR, EVEN_COLOR = '#FF9800', '#673AB7'
SECONDARY_COLOR, CENTROID_COLOR = '#795548', '#009688'
FP_FLAGS = {'koi_fpflag_nt': 'Not transit-like', 'koi_fpflag_ss': 'Stellar eclipse',
            'koi_fpflag_co': 'Centroid offset', 'koi_fpflag_ec': 'Ephemeris match'}


def _save_to(fig, path):
    if path:
        fig.savefig(path, bbox_inches='tight', dpi=120)
    return fig


def _draw_views_row(axes, v, color):
    """Global / transit + odd-even / secondary + centroid panels for one KOI."""
    g = np.asarray(v['global_view']).ravel()
    axes[0].plot(np.linspace(-0.5, 0.5, len(g)), g, color=color, lw=0.6)
    axes[0].set_xlabel('Orbital phase')
    x = np.linspace(-2, 2, len(np.asarray(v['local_view']).ravel()))
    axes[1].plot(x, v['local_view'], color=color, lw=2.2, alpha=0.35, label='all transits')
    axes[1].plot(x, v['odd_view'], color=ODD_COLOR, lw=1, label='odd')
    axes[1].plot(x, v['even_view'], color=EVEN_COLOR, lw=1, label='even')
    axes[1].set_xlabel('Time from mid-transit (transit durations)')
    axes[2].plot(x, v['secondary_view'], color=SECONDARY_COLOR, lw=1, label='secondary eclipse search')
    axes[2].set_xlabel('Time from deepest secondary dip (durations)')
    ax2 = axes[2].twinx()
    ax2.fill_between(x, v['centroid_view'], color=CENTROID_COLOR, alpha=0.25, label='centroid offset (px)')
    ax2.set_ylim(0, max(1.0, float(np.max(v['centroid_view'])) * 1.15))
    ax2.set_ylabel('Centroid offset (px)', color=CENTROID_COLOR, fontsize=8)
    ax2.tick_params(axis='y', labelsize=7, colors=CENTROID_COLOR)
    for ax in axes:
        ax.grid(True, alpha=0.3)
        ax.tick_params(labelsize=8)
    return ax2


def star_gazer_views(v, title, color, path=None):
    """All V3 views of one KOI: whole orbit on top; transit (odd/even overlaid),
    secondary eclipse and centroid shift below. `v` is a dict from star_gazer.views_for_koi."""
    fig = plt.figure(figsize=(13, 6.5))
    grid = fig.add_gridspec(2, 2, height_ratios=[1, 1.15])
    axes = [fig.add_subplot(grid[0, :]), fig.add_subplot(grid[1, 0]), fig.add_subplot(grid[1, 1])]
    ax2 = _draw_views_row(axes, v, color)
    axes[0].set_title('Global view: whole orbit, all Kepler quarters (transit at phase 0)', fontsize=10)
    axes[1].set_title('Transit zoom: odd and even transits should match for a planet', fontsize=10)
    axes[2].set_title('Secondary eclipse and centroid shift: both ~0 for a planet', fontsize=10)
    axes[1].legend(loc='lower left', fontsize=8)
    h1, l1 = axes[2].get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    axes[2].legend(h1 + h2, l1 + l2, loc='lower left', fontsize=8)
    axes[0].set_ylabel('Normalised flux')
    axes[1].set_ylabel('Flux / transit depth')
    fig.suptitle(title, color=color, fontweight='bold')
    fig.tight_layout()
    return _save_to(fig, path)


def v3_dataset_overview(table, y, path=None):
    """Class balance, orbital periods and planet radius vs period for the V3 dataset."""
    y = np.asarray(y)
    fig, axes = plt.subplots(1, 3, figsize=(17, 4.6))
    fig.suptitle(f'Star Gazer dataset: {len(y):,} KOIs on {table.kepid.nunique():,} stars, '
                 'all Kepler quarters', fontsize=13, fontweight='bold')
    counts = [int((y == 1).sum()), int((y == 0).sum())]
    bars = axes[0].bar(['Confirmed planet', 'False positive'], counts, color=[C.PLANET_COLOR, C.FP_COLOR])
    axes[0].bar_label(bars, labels=[f'{c:,} ({c / len(y):.0%})' for c in counts])
    axes[0].set_title('Class balance')
    bins = np.logspace(np.log10(0.2), np.log10(1500), 40)
    for label, color, name in ((1, C.PLANET_COLOR, 'Confirmed'), (0, C.FP_COLOR, 'False positive')):
        sel = y == label
        axes[1].hist(table.koi_period[sel], bins=bins, alpha=0.55, color=color, label=name)
        axes[2].scatter(table.koi_period[sel], table.koi_prad[sel], s=4, alpha=0.35, color=color, label=name)
    axes[1].set(xscale='log', xlabel='Orbital period (days)', ylabel='KOIs', title='Orbital periods')
    axes[2].set(xscale='log', yscale='log', xlabel='Orbital period (days)', ylabel='Radius (Earth radii)',
                title='Radius vs period')
    for ax in axes[1:]:
        ax.legend()
        ax.grid(True, alpha=0.3)
    plt.tight_layout()
    return _save_to(fig, path)


def v3_training_history(hist, path=None):
    """Loss / accuracy / AUC per epoch, with the epoch that early stopping kept."""
    best = int(np.argmax(hist['val_auc']))
    fig, axes = plt.subplots(1, 3, figsize=(17, 4.4))
    fig.suptitle('Star Gazer training history', fontsize=13, fontweight='bold')
    for ax, metric in zip(axes, ['loss', 'accuracy', 'auc']):
        epochs = np.arange(1, len(hist[metric]) + 1)
        ax.plot(epochs, hist[metric], lw=2, label='train')
        ax.plot(epochs, hist[f'val_{metric}'], lw=2, ls='--', label='validation')
        ax.axvline(best + 1, color='gray', ls=':', label=f'kept (epoch {best + 1})')
        ax.set(title=metric.upper() if metric == 'auc' else metric.capitalize(), xlabel='Epoch')
        ax.legend(fontsize=8)
        ax.grid(True, alpha=0.3)
    plt.tight_layout()
    return _save_to(fig, path)


def v3_ablation(results, path=None, labels=None):
    """Test accuracy and AUC of each model variant (results['<variant>']['threshold_val'])."""
    labels = labels or {}
    names = list(results)
    acc = [results[n]['threshold_val']['accuracy'] for n in names]
    aucs = [results[n]['threshold_val']['auc'] for n in names]
    fig, ax = plt.subplots(figsize=(max(8.0, 2.4 * len(names)), 4.8))
    x = np.arange(len(names))
    b1 = ax.bar(x - 0.2, acc, 0.4, color=C.PLANET_COLOR, label='Accuracy')
    b2 = ax.bar(x + 0.2, aucs, 0.4, color=C.CORRECT_COLOR, label='AUC')
    ax.bar_label(b1, labels=[f'{a:.1%}' for a in acc], fontsize=8)
    ax.bar_label(b2, labels=[f'{a:.3f}' for a in aucs], fontsize=8)
    ax.set_xticks(x, [labels.get(n, n) for n in names], fontsize=9)
    ax.set_ylim(max(0.0, min(acc + aucs) - 0.08), 1.0)
    ax.set_title('Which inputs matter? (same star-grouped test set)', fontweight='bold')
    ax.legend(loc='lower right')
    ax.grid(True, axis='y', alpha=0.3)
    plt.tight_layout()
    return _save_to(fig, path)


def v3_evaluation(y_true, y_prob, threshold, path=None):
    """Confusion matrix, ROC, precision-recall, score distributions, calibration, threshold sweep."""
    from sklearn.calibration import calibration_curve
    y_true, y_prob = np.asarray(y_true), np.asarray(y_prob)
    y_pred = (y_prob >= threshold).astype(int)
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle(f'Star Gazer on held-out stars ({len(y_true):,} KOIs, threshold {threshold:.2f})',
                 fontsize=14, fontweight='bold')
    ax = axes[0, 0]
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    annot = np.array([[f'{v:,}\n{v / max(cm[i].sum(), 1):.0%}' for v in row] for i, row in enumerate(cm)])
    sns.heatmap(cm, annot=annot, fmt='', cmap='Blues', ax=ax, cbar=False,
                xticklabels=['False Pos', 'Planet'], yticklabels=['False Pos', 'Planet'])
    ax.set(title='Confusion matrix (row %)', ylabel='True label', xlabel='Predicted label')

    fpr, tpr, _ = roc_curve(y_true, y_prob)
    ax = axes[0, 1]
    ax.plot(fpr, tpr, color=C.PLANET_COLOR, lw=2, label=f'AUC = {auc(fpr, tpr):.3f}')
    ax.plot([0, 1], [0, 1], color='gray', ls='--', lw=1)
    ax.fill_between(fpr, tpr, alpha=0.1, color=C.PLANET_COLOR)
    ax.set(xlabel='False positive rate', ylabel='True positive rate', title='ROC curve')

    prec, rec, _ = precision_recall_curve(y_true, y_prob)
    ax = axes[0, 2]
    ax.plot(rec, prec, color=C.CORRECT_COLOR, lw=2, label=f'PR AUC = {auc(rec, prec):.3f}')
    ax.axhline(y_true.mean(), color='gray', ls='--', lw=1, label=f'chance ({y_true.mean():.2f})')
    ax.set(xlabel='Recall', ylabel='Precision', title='Precision-recall curve')

    ax = axes[1, 0]
    bins = np.linspace(0, 1, 26)
    ax.hist(y_prob[y_true == 0], bins=bins, color=C.FP_COLOR, alpha=0.6, label='False positives')
    ax.hist(y_prob[y_true == 1], bins=bins, color=C.PLANET_COLOR, alpha=0.6, label='Confirmed planets')
    ax.axvline(threshold, color='black', ls='--', lw=1.2, label=f'threshold {threshold:.2f}')
    ax.set(xlabel='P(planet)', ylabel='KOIs', title='Score distributions (well separated = good)')

    ax = axes[1, 1]
    frac, mean_pred = calibration_curve(y_true, y_prob, n_bins=10, strategy='quantile')
    ax.plot([0, 1], [0, 1], color='gray', ls='--', lw=1, label='perfectly calibrated')
    ax.plot(mean_pred, frac, 'o-', color=C.PLANET_COLOR, lw=2, label='Star Gazer')
    ax.set(xlabel='Predicted P(planet)', ylabel='Fraction actually confirmed',
           title='Calibration (is 80% really 80%?)')

    ax = axes[1, 2]
    grid = np.linspace(0.02, 0.98, 49)
    preds = [(y_prob >= t).astype(int) for t in grid]
    ax.plot(grid, [(p == y_true).mean() for p in preds], lw=2, color='black', label='accuracy')
    ax.plot(grid, [y_true[p == 1].mean() if p.any() else np.nan for p in preds], lw=1.5,
            color=C.CORRECT_COLOR, label='precision')
    ax.plot(grid, [p[y_true == 1].mean() for p in preds], lw=1.5, color=C.PLANET_COLOR, label='recall')
    ax.axvline(threshold, color='gray', ls='--', lw=1.2, label='chosen on validation')
    ax.set(xlabel='Decision threshold', ylim=(0, 1.02), title='Threshold trade-off')

    for a in list(axes.flat)[1:]:
        a.legend(fontsize=8)
        a.grid(True, alpha=0.3)
    plt.tight_layout()
    return _save_to(fig, path)


def _accuracy_by(ax, values, correct, edges, labels, title, xlabel, color):
    idx = np.digitize(values, edges[1:-1])
    n = [int((idx == i).sum()) for i in range(len(labels))]
    acc = [correct[idx == i].mean() if k else 0.0 for i, k in enumerate(n)]
    bars = ax.bar(labels, acc, color=color, alpha=0.85)
    ax.bar_label(bars, labels=[f'{a:.0%}\nn={k}' if k else 'n=0' for a, k in zip(acc, n)], fontsize=7)
    ax.set(ylim=(0, 1.15), title=title, xlabel=xlabel, ylabel='Accuracy')
    ax.tick_params(axis='x', labelsize=8)


def v3_breakdown(table, y_true, y_prob, threshold, path=None):
    """Where Star Gazer succeeds or fails: by false-positive type, orbital period and signal strength.

    NASA's false-positive flags are used here only to analyse the test predictions;
    they are never model inputs.
    """
    y_true, y_prob = np.asarray(y_true), np.asarray(y_prob)
    correct = (y_prob >= threshold).astype(int) == y_true
    fig, axes = plt.subplots(1, 3, figsize=(18, 4.8))
    fig.suptitle('Where Star Gazer is right and wrong (test set)', fontsize=13, fontweight='bold')

    ax = axes[0]
    fp = y_true == 0
    names, rates, ns = [], [], []
    for col, label in FP_FLAGS.items():
        if col in table:
            sel = fp & (table[col].to_numpy() == 1)
            if sel.any():
                names.append(label)
                rates.append(correct[sel].mean())
                ns.append(int(sel.sum()))
    names.append('Confirmed planets\n(found)')
    rates.append(correct[~fp].mean())
    ns.append(int((~fp).sum()))
    colors = [C.FP_COLOR] * (len(names) - 1) + [C.PLANET_COLOR]
    bars = ax.bar(names, rates, color=colors, alpha=0.85)
    ax.bar_label(bars, labels=[f'{r:.0%}\nn={n}' for r, n in zip(rates, ns)], fontsize=8)
    ax.set(ylim=(0, 1.15), ylabel='Correctly classified', title="By NASA's false-positive type")
    ax.tick_params(axis='x', labelsize=8)

    _accuracy_by(axes[1], table.koi_period.to_numpy(), correct, [0, 3, 10, 30, 100, 300, np.inf],
                 ['<3 d', '3-10', '10-30', '30-100', '100-300', '>300 d'],
                 'By orbital period', 'Orbital period', '#5C6BC0')
    snr = table.koi_model_snr.fillna(0).to_numpy()
    _accuracy_by(axes[2], snr, correct, [0, 10, 20, 50, 100, 1000, np.inf],
                 ['<10', '10-20', '20-50', '50-100', '100-1k', '>1k'],
                 'By transit signal-to-noise', 'Transit SNR (koi_model_snr)', '#26A69A')
    for ax in axes:
        ax.grid(True, axis='y', alpha=0.3)
    plt.tight_layout()
    return _save_to(fig, path)


def v3_mistakes(views_by_row, names, y_true, y_prob, n=5, path=None):
    """The test KOIs the model got most confidently wrong, with all their views.

    views_by_row: callable i -> views dict for test row i.
    """
    y_true, y_prob = np.asarray(y_true), np.asarray(y_prob)
    worst = np.argsort(-np.abs(y_prob - y_true))[:n]
    fig, axes = plt.subplots(len(worst), 3, figsize=(17, 2.7 * len(worst)),
                             gridspec_kw={'width_ratios': [1.6, 1, 1]}, squeeze=False)
    fig.suptitle('Most confident mistakes (blue = really a planet, red = really a false positive)',
                 fontsize=13, fontweight='bold')
    for row, i in zip(axes, worst):
        _draw_views_row(row, views_by_row(i), _color(y_true[i]))
        truth = 'planet' if y_true[i] else 'false positive'
        row[0].set_title(f'{names[i]}: really a {truth}, model said P(planet) = {y_prob[i]:.0%}',
                         fontsize=9, color=C.WRONG_COLOR, loc='left')
        for ax in row:
            ax.set_xlabel('')
    axes[-1][0].set_xlabel('Orbital phase')
    axes[-1][1].set_xlabel('Transit durations (all / odd / even)')
    axes[-1][2].set_xlabel('Secondary dip (brown) + centroid offset (teal)')
    plt.tight_layout()
    return _save_to(fig, path)
