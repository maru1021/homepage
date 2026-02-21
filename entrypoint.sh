#!/bin/sh
set -e

echo "Creating log directory..."
mkdir -p /app/log

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Running migrations..."
python manage.py migrate --noinput

# 初回起動時のみデータをロード（テーブルが空の場合）
if python manage.py shell -c "from blog.models import Article; exit(0 if Article.objects.exists() else 1)" 2>/dev/null; then
    echo "Data already exists, skipping loaddata."
else
    if [ -f /app/data.json ]; then
        echo "Loading initial data..."
        python manage.py loaddata /app/data.json
    fi
fi

# デフォルトユーザーを作成（開発環境のみ）
if [ "$DEBUG" = "true" ] || [ "$DEBUG" = "True" ] || [ "$DEBUG" = "1" ]; then
    python manage.py shell -c "
from django.contrib.auth.models import User
u, created = User.objects.get_or_create(username='user', defaults={'first_name': '太郎', 'last_name': '山田'})
if created:
    u.set_password('password')
    u.save()
    print('Default user created.')
else:
    print('Default user already exists, skipping.')
" 2>/dev/null || true
else
    echo "Production mode: skipping default user creation."
fi

exec "$@"
