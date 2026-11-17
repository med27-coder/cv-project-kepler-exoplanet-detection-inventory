# Star Gazer (app.py, the Streamlit exoplanet classifier) as a container image.
# Blueprint and walkthrough: docs/cloud/DOCKER_BLUEPRINT.md
#
#   docker build -t star-gazer .
#   docker run --rm -p 8501:8501 -e KEPLER_ACCEPT_TERMS=1 -e STAR_GAZER_KEY="<key>" star-gazer
#   -> http://localhost:8501
#
# The trained model is inside the image only ENCRYPTED (secure/*.enc). The key is never baked in: it is
# passed at run time (a cloud "secret"), and docker/start.py decrypts the model when the container starts.

FROM python:3.12-slim

# Python inside containers: no .pyc clutter, logs straight to `docker logs`, no pip cache in the image
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app/src \
    MPLCONFIGDIR=/tmp/matplotlib

# Run as an ordinary user, not root (if the app is ever compromised, the attacker is not root)
RUN useradd --create-home --uid 1000 app
WORKDIR /app

# 1) Dependencies first. Docker caches each step ("layer"), so this slow step is skipped on rebuilds
#    unless requirements.lock itself changes. --require-hashes = exact, verified versions every build.
COPY requirements.lock .
RUN pip install --require-hashes -r requirements.lock

# 2) Then the code, which changes often (rebuilding from here takes seconds)
COPY app.py pyproject.toml TERMS_OF_USE.md ./
COPY .streamlit/config.toml .streamlit/config.toml
COPY src/ src/
COPY secure/ secure/
COPY scripts/tools/secure_artifacts.py scripts/tools/secure_artifacts.py
COPY docker/start.py docker/start.py

# Folders the app writes to at run time (NASA catalog, light-curve cache, decrypted model, terms record)
RUN mkdir -p data/raw data/interim models results \
    && chown app:app /app data data/raw data/interim models results

USER app
EXPOSE 8501

# Lets Docker / the cloud know whether the app is actually answering, not just running
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://localhost:' + os.environ.get('PORT', '8501') + '/_stcore/health')"

CMD ["python", "docker/start.py"]