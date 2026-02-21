"""
Django settings for config project.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# セキュリティ設定: SECRET_KEY
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')
    if DEBUG:
        SECRET_KEY = 'django-insecure-)m6!rg%5&=ve_v))i0r2e1gw@!(v@p7usjs64vm#v31+thbv3$'
    else:
        raise ValueError('本番環境ではSECRET_KEYの環境変数設定が必須です')
else:
    DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')

_allowed = os.environ.get('ALLOWED_HOSTS', '')
if _allowed:
    ALLOWED_HOSTS = [h.strip() for h in _allowed.split(',') if h.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ['*']
else:
    raise ValueError('本番環境ではALLOWED_HOSTSの環境変数設定が必須です')

# CSRF_TRUSTED_ORIGINS（本番環境で設定）
_csrf_origins = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
if _csrf_origins:
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_origins.split(',') if o.strip()]


# Application definition

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'django_htmx',
    'django.contrib.sitemaps',
    'blog',
    'dkc_drive',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    # X-Frame-Options はNginx側で設定するためXFrameOptionsMiddlewareは除外
    'django_htmx.middleware.HtmxMiddleware',
    'config.security_middleware.SecurityLoggingMiddleware',
    'config.security_middleware.AccessLoggingMiddleware',
    'config.security_middleware.PerformanceMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'blog.context_processors.site_name',
                'blog.context_processors.sidebar_classifications',
            ],
        },
    },
]

# 本番環境用のテンプレートキャッシュ設定
if not DEBUG:
    TEMPLATES[0]['APP_DIRS'] = False
    TEMPLATES[0]['OPTIONS']['loaders'] = [
        ('django.template.loaders.cached.Loader', [
            'django.template.loaders.filesystem.Loader',
            'django.template.loaders.app_directories.Loader',
        ]),
    ]

WSGI_APPLICATION = 'config.wsgi.application'

# Django Channels設定（WebSocket対応）
ASGI_APPLICATION = 'config.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    }
}


# Database

_db_password = os.environ.get('DATABASE_PASSWORD', 'blog' if DEBUG else '')
if not DEBUG and not _db_password:
    raise ValueError('本番環境ではDATABASE_PASSWORDの環境変数設定が必須です')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DATABASE_NAME', 'blog'),
        'USER': os.environ.get('DATABASE_USER', 'blog'),
        'PASSWORD': _db_password,
        'HOST': os.environ.get('DATABASE_HOST', 'db'),
        'PORT': os.environ.get('DATABASE_PORT', '5432'),
        'CONN_MAX_AGE': 600,
    }
}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization

LANGUAGE_CODE = 'ja'
TIME_ZONE = 'Asia/Tokyo'
USE_I18N = True
USE_TZ = True


# Static files

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
if not DEBUG:
    STORAGES = {
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ファイルアップロード設定（DKCドライブ対応）
DATA_UPLOAD_MAX_NUMBER_FILES = 100
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024  # 20MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024  # 20MB

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Site
SITE_NAME = 'マルオモスキートのお勉強部屋'

# セッション設定
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 86400 * 30  # 1ヶ月
SESSION_EXPIRE_AT_BROWSER_CLOSE = True  # ブラウザ閉じるとセッション削除
SESSION_SAVE_EVERY_REQUEST = True  # リクエスト毎にセッション有効期限を更新
SESSION_COOKIE_HTTPONLY = True  # JavaScript攻撃防止
SESSION_COOKIE_SAMESITE = 'Lax'  # CSRF保護と互換性を保つ

# CSRF保護設定
CSRF_COOKIE_HTTPONLY = False  # htmx互換のためFalse
CSRF_COOKIE_SAMESITE = 'Strict'
CSRF_USE_SESSIONS = False  # クッキーベース

# ログイン設定
LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/'

# セキュリティ設定
# X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy はNginx側で設定するため
# Django側では無効化して重複を防ぐ
SECURE_CONTENT_TYPE_NOSNIFF = False
SECURE_REFERRER_POLICY = None

# 本番環境用セキュリティ設定
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Slack通知設定
SLACK_BOT_TOKEN = os.environ.get('SLACK_BOT_TOKEN', '')

# ログ設定
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[%(asctime)s] %(levelname)s %(name)s: %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'csv': {
            'format': '%(asctime)s,%(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO' if DEBUG else 'ERROR',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'log' / 'django.log',
            'formatter': 'verbose',
        },
        'access_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'log' / 'access.log',
            'formatter': 'csv',
        },
        'performance_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'log' / 'performance.log',
            'formatter': 'csv',
        },
        'security_file': {
            'level': 'WARNING',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'log' / 'security.log',
            'formatter': 'csv',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'log' / 'error.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': True,
        },
        'dkc_drive': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'access': {
            'handlers': ['access_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'performance': {
            'handlers': ['performance_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'security': {
            'handlers': ['console', 'security_file'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# 本番環境かつ SLACK_BOT_TOKEN が設定されている場合、Slackハンドラを追加
if not DEBUG and SLACK_BOT_TOKEN:
    LOGGING['handlers'].update({
        'slack_security': {
            'level': 'WARNING',
            'class': 'config.slack_log_handler.SlackLogHandler',
            'channel': '#homepage-security',
            'token': SLACK_BOT_TOKEN,
            'formatter': 'verbose',
        },
        'slack_error': {
            'level': 'ERROR',
            'class': 'config.slack_log_handler.SlackLogHandler',
            'channel': '#homepage-error',
            'token': SLACK_BOT_TOKEN,
            'formatter': 'verbose',
        },
        'slack_performance': {
            'level': 'WARNING',
            'class': 'config.slack_log_handler.SlackLogHandler',
            'channel': '#homepage-performance',
            'token': SLACK_BOT_TOKEN,
            'formatter': 'csv',
        },
        'slack_access': {
            'level': 'INFO',
            'class': 'config.slack_log_handler.SlackLogHandler',
            'channel': '#homepage-access',
            'token': SLACK_BOT_TOKEN,
            'formatter': 'csv',
        },
        'slack_general': {
            'level': 'WARNING',
            'class': 'config.slack_log_handler.SlackLogHandler',
            'channel': '#homepage-general',
            'token': SLACK_BOT_TOKEN,
            'formatter': 'verbose',
        },
    })
    LOGGING['loggers']['security']['handlers'].append('slack_security')
    LOGGING['loggers']['django.request']['handlers'].append('slack_error')
    LOGGING['loggers']['performance']['handlers'].append('slack_performance')
    LOGGING['loggers']['access']['handlers'].append('slack_access')
    LOGGING['loggers']['django']['handlers'].append('slack_general')
