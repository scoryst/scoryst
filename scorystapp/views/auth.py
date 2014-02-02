from django import shortcuts, http
from scorystapp import decorators, forms, models
from scorystapp.views import helpers
from django.contrib import auth
from django.contrib.auth import views


def _get_redirect_path(request, redirect_path, user):
  """ Returns the correct redirect path, if any, from login. """
  if redirect_path:
    # redirect path is relative to root
    redirect_path = '/%s' % redirect_path
  else:
    course_users = models.CourseUser.objects.filter(user=user).order_by('-course__id')
    if course_users:
      if course_users[0].privilege == models.CourseUser.STUDENT:
        redirect_path = '/course/%d/exams/view/' % course_users[0].course.pk  
      else:
        redirect_path = '/course/%d/roster/' % course_users[0].course.pk
    else:
      redirect_path = '/about/'

  return redirect_path


def login(request, redirect_path=None):
  """ Allows the user to log in. """
  
  if request.user.is_authenticated():
    return shortcuts.redirect(_get_redirect_path(request, redirect_path, request.user))

  if request.method == 'POST':
    form = forms.UserLoginForm(request.POST)

    if form.is_valid():
      # authentication should pass cleanly (already checked by UserLoginForm)
      user = auth.authenticate(username=form.cleaned_data['email'],
        password=form.cleaned_data['password'])
      auth.login(request, user)
      return shortcuts.redirect(_get_redirect_path(request, redirect_path, user))
  else:
    form = forms.UserLoginForm()

  return helpers.render(request, 'login.epy', {
    'title': 'Login',
    'login_form': form,
  })


def logout(request):
  """ Allows the user to log out. """
  auth.logout(request)
  return shortcuts.redirect('/login')


@decorators.login_required
def change_password(request):
  """ Allows the user to reset his/her password. """
  extra_context = helpers.get_extra_context(request)
  extra_context['title'] = 'Change Password'
  return views.password_change(request, template_name='reset/password-change-form.epy',
    extra_context=extra_context, post_change_redirect='done')


@decorators.login_required
def done_change_password(request):
  """ Confirmation page that password is successfully changed. """
  extra_context = helpers.get_extra_context(request)
  extra_context['title'] = 'Password Change Done'
  return views.password_change_done(request, template_name='reset/password-change-done.epy',
    extra_context=extra_context)
