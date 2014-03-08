from scorystapp.views import helpers
from scorystapp import decorators


@decorators.login_required
def not_found_error(request):
  """ Displays a not found error page. """
  return helpers.render(request, 'not-found.epy', {
    'title': 'Page Not Found'
  })


@decorators.login_required
def server_error(request):
  """ Displays an internal server error page. """
  return helpers.render(request, 'server-error.epy', {
    'title': 'Server Error'
  })
