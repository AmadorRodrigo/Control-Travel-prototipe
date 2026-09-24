#!/bin/sh
set -eu

nginx -t
nginx

wget -S -O /dev/null 'http://127.0.0.1/reset-password?token=smoke-test-only' 2>/tmp/html-headers
grep -q 'Cache-Control: no-store' /tmp/html-headers
grep -q 'Referrer-Policy: no-referrer' /tmp/html-headers
grep -q 'Content-Security-Policy:' /tmp/html-headers

for asset in /usr/share/nginx/html/assets/*.js; do
    wget -S -O /dev/null "http://127.0.0.1/assets/${asset##*/}" 2>/tmp/asset-headers
    grep -q 'Cache-Control: public, max-age=31536000, immutable' /tmp/asset-headers
    grep -q 'X-Content-Type-Options: nosniff' /tmp/asset-headers
    break
done

if wget -S -O /dev/null http://127.0.0.1/assets/missing.js 2>/tmp/missing-headers; then
    echo 'Missing assets must return 404, not the SPA HTML' >&2
    exit 1
fi
grep -q '404 Not Found' /tmp/missing-headers
if grep -q immutable /tmp/missing-headers; then
    echo 'Missing assets must not be cached as immutable' >&2
    exit 1
fi

echo 'Nginx smoke checks passed: SPA fallback, HTML/asset caching, security headers, asset 404.'
