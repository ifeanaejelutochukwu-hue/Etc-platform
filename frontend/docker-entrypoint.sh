#!/bin/sh
# Replace $BACKEND_URL placeholder in nginx config at container start time
# so Railway's runtime env var is respected.
set -e

: "${BACKEND_URL:=http://localhost:8080}"

envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf > /tmp/default.conf
cp /tmp/default.conf /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
