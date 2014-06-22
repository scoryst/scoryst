from scorystapp import models
from django.core import mail
from django.contrib.sites.models import get_current_site
from django.template import loader
from django.utils import http
from django.contrib.auth.tokens import default_token_generator


def _send_assessment_graded_email(request, course_users, assessment):
  """
  Sends an email to each course_user telling him that the assessment has been graded.
  If the user has not signed_up, we ask them to set a password
  """
  messages = []

  current_site = get_current_site(request)
  site_name = current_site.name
  domain = current_site.domain
  from_email = 'Scoryst <grades@%s>' % domain

  for course_user in course_users:
    user = course_user.user

    context = {
      'course': course_user.course,
      'email': user.email,
      'assessment': assessment,
      'domain': domain,
      'site_name': site_name,
      'user': user,
      'protocol': 'https',
    }

    if not user.is_signed_up:
      context.update(
        {
          # uid and token are needed for security purposes for generating one-time
          # only reset links
          'uid': http.int_to_base36(user.pk),
          'token': default_token_generator.make_token(user),
        }
      )
      email_template_name = 'email/view-graded-assessment-unregistered.epy'
    else:
      email_template_name = 'email/view-graded-assessment.epy'

    subject = '%s %s Grades' % (course_user.course.name, assessment.name)
    email = loader.render_to_string(email_template_name, context)
    messages.append((subject, email, from_email, [user.email]))

  mail.send_mass_mail(tuple(messages))


def _send_added_to_course_email(request, course_users):
  """
  Sends an email to each course_user telling him that he has been added as an instructor/TA etc.
  to the given course. If the user hasn't signed up, it also allows the user to set a password.
  """

  messages = []
  current_site = get_current_site(request)
  site_name = current_site.name
  domain = current_site.domain
  from_email = 'Scoryst <courses@%s>' % domain

  for course_user in course_users:
    user = course_user.user

    privilege = models.CourseUser.USER_PRIVILEGE_CHOICES[int(course_user.privilege)][1].lower()
    article = 'an' if privilege[0] in 'aeiou' else 'a'

    # Use the display case so TA is displayed as 'TA' but Instructor is shown as 'instructor'
    privilege = models.CourseUser.USER_LOWERCASE_DISPLAY_CHOICES[int(course_user.privilege)][1]

    context = {
      'article': article,
      'privilege': privilege,
      'course': course_user.course,
      'email': user.email,
      'domain': domain,
      'site_name': site_name,
      'user': user,
      'protocol': 'https',
    }

    if not user.is_signed_up:
      context.update(
        {
          # uid and token are needed for security purposes for generating one-time
          # only reset links
          'uid': http.int_to_base36(user.pk),
          'token': default_token_generator.make_token(user),
        }
      )
      email_template_name = 'email/added-to-course-unregistered.epy'
    else:
      email_template_name = 'email/added-to-course.epy'

    subject = 'You have been added to %s' % course_user.course.name
    email = loader.render_to_string(email_template_name, context)
    messages.append((subject, email, from_email, [user.email]))

  mail.send_mass_mail(tuple(messages))


def send_sign_up_confirmation(request, user):
  """ Sends a confirmation email to the given user. """
  current_site = get_current_site(request)
  site_name = current_site.name
  domain = current_site.domain
  from_email = 'Scoryst <signup@%s>' % domain

  context = {
    'email': user.email,
    'domain': domain,
    'site_name': site_name,
    'user': user,
    'protocol': 'https',
    'uid': http.int_to_base36(user.pk),
    'token': default_token_generator.make_token(user),
  }
  email_template_name = 'email/sign-up-confirmation.epy'
  subject = 'Welcome to Scoryst'
  email = loader.render_to_string(email_template_name, context)
  mail.send_mail(subject, email, from_email, [user.email])


def send_added_to_course_email(request, course_users, send_to_students=False):
  """
  Sends email to each course_user in course_users who is an instructor or a TA.
  Care is taken if course_user is unregistered
  """
  send_to = []
  for course_user in course_users:
    # Don't send emails to students when added to roster unless send_to_students is true
    if int(course_user.privilege) != models.CourseUser.STUDENT or send_to_students:
      send_to.append(course_user)

  _send_added_to_course_email(request, send_to)


def send_assessment_graded_email(request, assessment):
  """
  Sends an email to students if their assessment answer corresponding to the assessment is graded
  and they have not been previously notified.
  """

  submissions = models.Submission.objects.filter(assessment=assessment, preview=False, released=False)
  graded_submissions = filter(lambda answer: answer.is_graded(), submissions)
  course_users = []
  for submission in graded_submissions:
    course_users.append(submission.course_user)
    submission.released = True
    submission.save()

  _send_assessment_graded_email(request, course_users, assessment)
