# The Kepler Star Map (web/, static HTML/JS) served by nginx.
#   docker build -f docker/web.Dockerfile -t star-map .
#   docker run --rm -p 8080:8080 star-map        -> http://localhost:8080
#
# A static site needs no Python at all: just a small web server image plus the files (about 50 MB total).

# nginx-unprivileged = the official nginx, set up to run as a non-root user on port 8080
FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://localhost:8080/ || exit 1