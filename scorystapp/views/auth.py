from django import shortcuts, http
from scorystapp import decorators, forms, utils
from scorystapp.views import helpers, email_sender, general
from scorystapp.views import course as course_view
from django.contrib import auth
from django.contrib.auth import views


def login(request, redirect_path=None, token=None):
  """ Allows the user to log in. """

  if request.user.is_authenticated():
    return shortcuts.redirect(general.get_redirect_path(request.user, redirect_path))

  if request.method == 'POST':
    form = forms.UserLoginForm(request.POST)

    if form.is_valid():
      # authentication should pass cleanly (already checked by UserLoginForm)
      user = auth.authenticate(username=form.cleaned_data['email'],
        password=form.cleaned_data['password'])
      auth.login(request, user)

      if 'token' in request.session:
        token = request.session['token']
        redirect_path = 'enroll/%s/' % token
        del request.session['token']

      return shortcuts.redirect(general.get_redirect_path(request.user, redirect_path))
  else:
    form = forms.UserLoginForm()

  # If the redirect path is of enroll/<token>/, we set 'enroll_page' to True
  # to make clear that the user will be added to the course after logging in
  if token:
    print redirect_path
    course, privilege = course_view._get_course_and_privilege_from_token(token)

    if course == None:
      raise http.Http404

    course_name = course.name
    enroll_page = True
    request.session['token'] = token
  else:
    course_name = None
    enroll_page = False

  return helpers.render(request, 'login.epy', {
    'title': 'Login',
    'login_form': form,
    'course_name': course_name,
    'enroll_page': enroll_page
  })


def logout(request):
  """ Allows the user to log out. """
  auth.logout(request)
  return shortcuts.redirect('/login')


def sign_up(request):
  """ Allows the user to create an account on Scoryst. """
  if request.method == 'POST':
    form = forms.UserSignupForm(request.POST)
    if form.is_valid():
      email = form.cleaned_data.get('email')
      first_name = form.cleaned_data.get('first_name')
      last_name = form.cleaned_data.get('last_name')
      student_id = form.cleaned_data.get('student_id')

      password = utils.generate_random_string(50)
      user = auth.get_user_model().objects.create_user(email, first_name,
        last_name, student_id, password)

      # Send an email to confirm sign up and ask the user to set a password
      # user.is_signed_up will be False till then
      email_sender.send_sign_up_confirmation(request, user)

      return helpers.render(request, 'sign-up-done.epy', { 'title': 'Sign up Successful' })
  else:
    form = forms.UserSignupForm()

  return helpers.render(request, 'sign-up.epy', {
    'title': 'Sign up',
    'sign_up_form': form,
  })


@decorators.login_required
def change_password(request):
  """ Allows the user to reset his/her password. """
  extra_context = helpers.get_extra_context(request)
  extra_context['title'] = 'Change Password'
  return views.password_change(request, template_name='reset/password-change-form.epy',
    extra_context=extra_context, post_change_redirect='done',
    password_change_form=forms.PasswordWithMinLengthChangeForm)


@decorators.login_required
def done_change_password(request):
  """ Confirmation page that password is successfully changed. """
  extra_context = helpers.get_extra_context(request)
  extra_context['title'] = 'Password Change Done'
  return views.password_change_done(request, template_name='reset/password-change-done.epy',
    extra_context=extra_context)
