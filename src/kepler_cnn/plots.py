"""Figures for the notebook. Each function saves into results/v2/ and returns the figure."""

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
