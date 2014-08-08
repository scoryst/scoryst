from django import shortcuts
from django.db.models import Q
from scorystapp import forms, models
from scorystapp.views import helpers


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
  if request.user.is_authenticated():
    return shortcuts.redirect(get_initial_path(request.user))
  return shortcuts.render(request, 'landing-page.epy')


def get_initial_path(user, redirect_path=None):
  """
  If there is a `redirect_path` that is not `None`, simply return that.

  Otherwise, the redirect path can be one of three options:
  1. For an authenticated user that is an instructor or TA, redirect them to the
     roster page of their latest class.
  2. For an authenticated student user, redirect them to the welcome page.
  3. Otherwise, redirect them to the landing page.
  """
  if redirect_path:
    # redirect path is relative to root
    redirect_path = '/%s' % redirect_path
  else:
    course_users = (models.CourseUser.objects.filter(Q(user=user),
      Q(privilege=models.CourseUser.INSTRUCTOR) | Q(privilege=models.CourseUser.TA))
      .prefetch_related('course').order_by('-course__id'))
    # If a user is an instructor or TA for any class, show him the course roster
    # page of the last course (by id). Otherwise, we just show the welcome page
    if course_users:
      redirect_path = '/course/%d/roster/' % course_users[0].course.pk
    else:
      redirect_path = '/welcome/'

  return redirect_path


def help(request):
  return helpers.render(request, 'help.epy', {
    'title': 'Help',
  })
