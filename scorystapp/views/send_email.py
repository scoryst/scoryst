from scorystapp import models
from django.core import mail
from django.contrib.sites.models import get_current_site
from django.template import loader
from django.utils import http
from django.contrib.auth.tokens import default_token_generator


def _send_exam_graded_email(request, course_users, exam):
  """
  Sends an email to each course_user telling him that the exam has been graded.
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
      'exam': exam,
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
      email_template_name = 'email/view-graded-exam-unregistered.epy'
    else:
      email_template_name = 'email/view-graded-exam.epy'

    subject = '%s %s Grades' % (course_user.course.name, exam.name)
    email = loader.render_to_string(email_template_name, context)
    messages.append((subject, email, from_email, [user.email]))

  mail.send_mass_mail(tuple(messages))


def _send_added_to_course_email(request, course_users):
  """
  Sends an email to each course_user telling him that he has been added as an instructor/TA etc.
  to the given course. If the user hasn't signed up, it also allows them to set their password.
  """

  messages = []
  current_site = get_current_site(request)
  site_name = current_site.name
  domain = current_site.domain
  from_email = 'Scoryst <courses@%s>' % domain

  for course_user in course_users:
    user = course_user.user
    
    if int(course_user.privilege) == models.CourseUser.TA:
      privilege = 'TA'
      article = 'a'
    elif int(course_user.privilege) == models.CourseUser.INSTRUCTOR:
      privilege = 'instructor'
      article = 'an'
    else:
      privilege = 'student'
      article = 'a'

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
  

def send_exam_graded_email(request, exam):
  """
  Sends an email to students if their exam answer corresponding to the exam is graded
  and they have not been previously notified.
  """

  exam_answers = models.ExamAnswer.objects.filter(exam=exam, preview=False, released=False)
  graded_exams = filter(lambda answer: answer.is_graded(), exam_answers)
  course_users = []
  for exam_answer in graded_exams:
    course_users.append(exam_answer.course_user)
    exam_answer.released = True
    exam_answer.save()
    
  _send_exam_graded_email(request, course_users, exam)
