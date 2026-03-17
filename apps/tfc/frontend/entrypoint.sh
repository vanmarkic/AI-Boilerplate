#!/bin/sh
# Inject runtime environment variables into the built Angular app.
# This replaces placeholder values in the JS bundles so the API URL
# can be configured at deploy time (not build time).

INDEX_FILE=/usr/share/nginx/html/index.html

# Inject a <script> block with runtime config before </head>
# Angular reads these from window.__env at bootstrap.
if [ -n "$API_BASE_URL" ]; then
  sed -i "s|</head>|<script>window.__env={apiBaseUrl:\"${API_BASE_URL}\",wsBaseUrl:\"${WS_BASE_URL:-${API_BASE_URL}}\"};</script></head>|" "$INDEX_FILE"
fi
