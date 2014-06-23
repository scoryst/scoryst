import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Django settings for scorystproject project.

DEBUG = True
TEMPLATE_DEBUG = DEBUG

# TODO: Don't do this. Either don't use mandrill or hello@scoryst
ADMINS = (
  ('Catherine Lu', 'catherineglu@gmail.com'),
  ('Karanveer Mohan', 'karanveer.1992@gmail.com'),
  ('Karthik Viswanathan', 'karthik.ksv@gmail.com'),
)

SERVER_EMAIL = 'Scoryst Support <support@scoryst.com>'

MANAGERS = ADMINS

DATABASES = {
  'default': {
    'ENGINE': 'django.db.backends.sqlite3',  # Add 'postgresql_psycopg2', 'mysql', 'sqlite3' or 'oracle'.
    'NAME': '%s/sqlite3.db' % BASE_DIR,  # Or path to database file if using sqlite3.

    # The following settings are not used with sqlite3:
    'USER': '',
    'PASSWORD': '',
    'HOST': '',  # Empty for localhost through domain sockets or '127.0.0.1' for localhost through TCP.
    'PORT': '',  # Set to empty string for default.
  }
}

# Hosts/domain names that are valid for this site; required if DEBUG is False
# See https://docs.djangoproject.com/en/1.5/ref/settings/#allowed-hosts
ALLOWED_HOSTS = []

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# In a Windows environment this must be set to your system time zone.
TIME_ZONE = 'America/Los_Angeles'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale.
USE_L10N = True

# If you set this to False, Django will not use timezone-aware datetimes.
USE_TZ = True

# Absolute filesystem path to the directory that will hold user-uploaded files.
# Example: "/var/www/example.com/media/"
MEDIA_ROOT = ''

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash.
# Examples: "http://example.com/media/", "http://media.example.com/"
MEDIA_URL = ''

# Absolute path to the directory static files should be collected to.
# Don't put anything in this directory yourself; store your static files
# in apps' "static/" subdirectories and in STATICFILES_DIRS.
# Example: "/var/www/example.com/static/"
STATIC_ROOT = BASE_DIR + '/../scorystapp/static/'

# URL prefix for static files.
# Example: "http://example.com/static/", "http://static.example.com/"
STATIC_URL = '/static/'

# Additional locations of static files
STATICFILES_DIRS = (
  # Put strings here, like "/home/html/static" or "C:/www/django/static".
  # Always use forward slashes, even on Windows.
  # Don't forget to use absolute paths, not relative paths.
)

# List of finder classes that know how to find static files in
# various locations.
STATICFILES_FINDERS = (
  'django.contrib.staticfiles.finders.FileSystemFinder',
  'django.contrib.staticfiles.finders.AppDirectoriesFinder',
  # 'django.contrib.staticfiles.finders.DefaultStorageFinder',
  'compressor.finders.CompressorFinder',
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = '(7va-8*edpgn0jdtrw6_hs40)-6ni35o-a^+78onbn%2pimv=r'

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
  'django.template.loaders.filesystem.Loader',
  'django.template.loaders.app_directories.Loader',
  # 'django.template.loaders.eggs.Loader',
)

# Note: if you modify this, you'll need to update local-settings.py on
# production, as it overrides MIDDLEWARE_CLASSES
MIDDLEWARE_CLASSES = (
  'debug_toolbar.middleware.DebugToolbarMiddleware',
  'scorystapp.middleware.middleware.ChangeToCamelCaseMiddleware',
  'django.middleware.common.CommonMiddleware',
  'django.contrib.sessions.middleware.SessionMiddleware',
  'django.middleware.csrf.CsrfViewMiddleware',
  'django.contrib.auth.middleware.AuthenticationMiddleware',
  'django.contrib.messages.middleware.MessageMiddleware',
  # Uncomment the next line for simple clickjacking protection:
  # 'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

ROOT_URLCONF = 'scorystproject.urls'

# Python dotted path to the WSGI application used by Django's runserver.
WSGI_APPLICATION = 'scorystproject.wsgi.application'

TEMPLATE_DIRS = (
  os.path.join(BASE_DIR,'templates'),
  # Put strings here, like "/home/html/django_templates" or "C:/www/django/templates".
  # Always use forward slashes, even on Windows.
  # Don't forget to use absolute paths, not relative paths.
)

INSTALLED_APPS = (
  'bootstrap3_datetime',
  'django.contrib.auth',
  'django.contrib.contenttypes',
  'django.contrib.sessions',
  'django.contrib.sites',
  'django.contrib.messages',
  'django.contrib.staticfiles',
  # Uncomment the next line to enable the admin:
  'django.contrib.admin',
  # Uncomment the next line to enable admin documentation:
  # 'django.contrib.admindocs',
  'scorystapp',
  'widget_tweaks',
  'compressor',
  'django_extensions',
  'storages',
  'djrill',
  'djcelery',
  'djcelery_email',
  'rest_framework',
  'debug_toolbar',
  'south',
)

DEFAULT_FILE_STORAGE = 'storages.backends.s3boto.S3BotoStorage'

# Imported from local_settings
AWS_S3_ACCESS_KEY_ID = ''
AWS_S3_SECRET_ACCESS_KEY = ''
AWS_STORAGE_BUCKET_NAME = ''

# If one enables Access to private, the links will no longer be public
# and the cache will break
# AWS_DEFAULT_ACL = 'private'
AWS_QUERYSTRING_AUTH = False
AWS_HEADERS = {
  'Cache-Control': 'max-age=86400', #(1 day)
}

# To allow django-admin.py collectstatic to automatically put your static files
# in your bucket set the following:
# STATICFILES_STORAGE = 'storages.backends.s3boto.S3BotoStorage'

# Safer version for the signed cookie session backend
SESSION_SERIALIZER = 'django.contrib.sessions.serializers.JSONSerializer'

# A sample logging configuration. The only tangible logging
# performed by this configuration is to send an email to
# the site admins on every HTTP 500 error when DEBUG=False.
# See http://docs.djangoproject.com/en/dev/topics/logging for
# more details on how to customize your logging configuration.
LOGGING = {
  'version': 1,
  'disable_existing_loggers': False,
  'filters': {
    'require_debug_false': {
      '()': 'django.utils.log.RequireDebugFalse'
    }
  },
  'handlers': {
    'mail_admins': {
      'level': 'ERROR',
      'filters': ['require_debug_false'],
      'class': 'django.utils.log.AdminEmailHandler'
    }
  },
  'loggers': {
    'django.request': {
      'handlers': ['mail_admins'],
      'level': 'ERROR',
      'propagate': True,
    },
  }
}

# Celery needed for async email sending
import djcelery
djcelery.setup_loader()

# Use Redis as the broker
BROKER_URL = 'redis://localhost:6379/0'
CELERY_IMPORTS=('scorystapp.views.exams', 'scorystapp.views.upload',
  'workers.dispatcher', 'scorystapp.views.split', 'scorystapp.views.submit')

EMAIL_BACKEND = 'djcelery_email.backends.CeleryEmailBackend'
CELERY_EMAIL_BACKEND = 'djrill.mail.backends.djrill.DjrillBackend'

# Imported from local_settings
MANDRILL_API_KEY = ''
DEFAULT_FROM_EMAIL = 'Scoryst Support <support@scoryst.com>'

# use a custom user model
AUTH_USER_MODEL = 'scorystapp.User'

# prevent toolbar from changing settings automatically
DEBUG_TOOLBAR_PATCH_SETTINGS = False

DEBUG_TOOLBAR_PANELS = [
  'debug_toolbar.panels.versions.VersionsPanel',
  'debug_toolbar.panels.timer.TimerPanel',
  'debug_toolbar.panels.settings.SettingsPanel',
  'debug_toolbar.panels.headers.HeadersPanel',
  'debug_toolbar.panels.request.RequestPanel',
  'debug_toolbar.panels.sql.SQLPanel',
  'debug_toolbar.panels.staticfiles.StaticFilesPanel',
  'debug_toolbar.panels.templates.TemplatesPanel',
  'debug_toolbar.panels.cache.CachePanel',
  'debug_toolbar.panels.signals.SignalsPanel',
  'debug_toolbar.panels.logging.LoggingPanel',
  'debug_toolbar.panels.redirects.RedirectsPanel',
  'scorystapp.panels.SwitchUserPanel',
]

# show toolbar only when running on localhost
INTERNAL_IPS = '127.0.0.1'

# Use development settings
from local_settings import *
