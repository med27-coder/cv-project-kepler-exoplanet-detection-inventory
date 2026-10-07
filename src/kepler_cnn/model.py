"""AstroNet-style 1D CNN: build, train, save/load, evaluate, predict."""

import json
import time

import numpy as np
from sklearn.model_selection import train_test_split

from . import config as C
from .terms import ensure_accepted


def _keras():
    from tensorflow import keras  # slow import, keep it lazy
    return keras


def set_seed(seed=C.SEED):
    _keras().utils.set_random_seed(seed)


def split(X, y, seed=C.SEED):
    """Stratified 68 / 12 / 20 train / val / test split (same as V1.5)."""
    X_cnn = X.reshape(len(X), C.BINS, 1)
    X_train, X_test, y_train, y_test = train_test_split(
        X_cnn, y, test_size=0.2, random_state=seed, stratify=y)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.2, random_state=seed, stratify=y_train)
    return X_train, X_val, X_test, y_train, y_val, y_test


def build_model(n=C.BINS):
    """4 x (Conv1D -> BatchNorm -> ReLU -> MaxPool) blocks + dense head."""
    keras = _keras()
    layers = keras.layers

    inp = keras.Input(shape=(n, 1))
    x = inp
    for filters in (16, 32, 64, 128):
        x = layers.Conv1D(filters, 5, padding='same', use_bias=False)(x)
        x = layers.BatchNormalization()(x)
        x = layers.Activation('relu')(x)
        x = layers.MaxPooling1D(2)(x)

    x = layers.Flatten()(x)
    x = layers.Dense(512, activation='relu')(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1, activation='sigmoid')(x)

    model = keras.Model(inp, out, name='exoplanet_cnn')
    model.compile(
        optimizer=keras.optimizers.Adam(1e-4),
        loss='binary_crossentropy',
        metrics=['accuracy',
                 keras.metrics.AUC(name='auc'),
                 keras.metrics.Precision(name='precision'),
                 keras.metrics.Recall(name='recall')],
    )
    return model


def train(model, X_train, y_train, X_val, y_val, epochs=60, batch_size=32):
    """Fit with early stopping on val AUC; returns the history dict and saves it."""
    ensure_accepted()
    keras = _keras()
    callbacks = [
        keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True,
                                      monitor='val_auc', mode='max'),
        keras.callbacks.ReduceLROnPlateau(patience=4, factor=0.5,
                                          monitor='val_loss', verbose=1),
    ]
    history = model.fit(X_train, y_train, validation_data=(X_val, y_val),
                        epochs=epochs, batch_size=batch_size,
                        callbacks=callbacks, verbose=1)
    hist = {k: [float(v) for v in vals] for k, vals in history.history.items()}
    C.ensure_dirs()
    C.HISTORY_FILE.write_text(json.dumps(hist, indent=2), encoding='utf-8')
    return hist


def save_model(model):
    C.ensure_dirs()
    model.save(C.MODEL_FILE)
    print(f'Model saved to {C.rel(C.MODEL_FILE)}')


def load_trained_model(path=None):
    """Load a saved .keras model (works with models saved on Colab by V1.5)."""
    path = path or C.MODEL_FILE
    model = _keras().models.load_model(path)
    print(f'Loaded model from {C.rel(path)}')
    return model


def load_history():
    if C.HISTORY_FILE.exists():
        return json.loads(C.HISTORY_FILE.read_text(encoding='utf-8'))
    return None


def evaluate(model, X_test, y_test, threshold=C.THRESHOLD):
    """Test-set metrics as a dict, plus probabilities and hard predictions."""
    y_prob = model.predict(X_test, verbose=0).flatten()
    y_pred = (y_prob >= threshold).astype(int)
    values = model.evaluate(X_test, y_test, verbose=0, return_dict=True)
    metrics = {k: float(v) for k, v in values.items()}

    start = time.perf_counter()
    model.predict(X_test[:10], verbose=0)
    metrics['ms_per_curve'] = (time.perf_counter() - start) / min(10, len(X_test)) * 1000
    return metrics, y_prob, y_pred


def predict_flux(model, flux, threshold=C.THRESHOLD):
    """Planet probability and verdict for a single folded light curve."""
    prob = float(model.predict(np.asarray(flux).reshape(1, C.BINS, 1), verbose=0)[0][0])
    verdict = 'PLANET' if prob >= threshold else 'FALSE POSITIVE'
    return prob, verdict
