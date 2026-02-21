#!/bin/sh
# ADMIN_IPS (カンマ区切り) から nginx の allow ルールを生成
set -e

ALLOW_RULES=""
IFS=','
for ip in $ADMIN_IPS; do
    ip=$(echo "$ip" | tr -d ' ')
    [ -n "$ip" ] && ALLOW_RULES=$(printf '%s        allow %s;\n' "$ALLOW_RULES" "$ip")
done

sed "s|__ALLOW_RULES__|${ALLOW_RULES}|g" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
