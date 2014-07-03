from scorystapp.views import helpers
from django import shortcuts
from scorystapp import forms
from scorystapp.views import auth


def about(request):
  return helpers.render(request, 'about.epy', {
    'title': 'About',
  })


def welcome(request):
  """ Shows a basic welcome page with the ability to enroll in a class. """
  if request.method == 'POST':
    form = forms.TokenForm(request.POST)
    if form.is_valid():
      token = form.cleaned_data.get('token')
      return shortcuts.redirect('/enroll/%s' % token)
  else:
    form = forms.TokenForm()

  return helpers.render(request, 'welcome.epy', {
    'title': 'Welcome',
    'token_form': form,
  })


def root(request):
  """
  If the user is authenticated, get the correct redirect path. For a user that
  is an instructor or TA, redirect them to the roster page of their latest class.
  If the user is a student, redirect them to the welcome page. Otherwise, if the
  user is not authenticated, redirect them to the landing page.
  """
  if request.user.is_authenticated():
    return shortcuts.redirect(auth.get_redirect_path(request, None, request.user))
  return shortcuts.render(request, 'landing-page.epy')
