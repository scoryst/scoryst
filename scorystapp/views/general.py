from scorystapp.views import helpers
from django import shortcuts
from scorystapp import forms


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


def landing_page(request):
  # TODO: remove later
  return shortcuts.redirect('/login')
  return shortcuts.render(request, 'landing-page.epy')
