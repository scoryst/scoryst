from django import shortcuts
from django.contrib import auth
from django.conf import urls, settings
from django.template import loader

from debug_toolbar import panels
import models

class SwitchUserPanel(panels.DebugPanel):
  template = 'switch-user.epy'

  def nav_title(self):
    """ Returns the navigation title of this panel. """
    return 'Switch User'

  def title(self):
    """ Returns the main pane title of this panel. """
    return 'Switch User'

  @classmethod
  def get_urls(cls):
    """ Returns the URL routes this panel needs. """ 
    return urls.patterns('',
      urls.url(r'^login/as/(?P<email>.*?)$', 'scorystapp.panels.login_as',
        name='login_as')
    )

  @property
  def content(self):
    """ Returns the content within this panel. """
    return loader.render_to_string(self.template, {
      'users': models.User.objects.all()
    })

def login_as(request, email):
  """ Logs in as the user specified by the given email. Redirects to the prior page. """
  user = shortcuts.get_object_or_404(models.User, email=email)

  # hack: set backend attribute directly to circumvent need to call authenticate():
  # http://stackoverflow.com/questions/3807777/django-login-without-authenticating
  user.backend = settings.AUTHENTICATION_BACKENDS[0]
  auth.login(request, user)

  return shortcuts.redirect(request.META['HTTP_REFERER'])
