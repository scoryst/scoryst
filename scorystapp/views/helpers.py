from scorystapp import models
from django import shortcuts
from django.utils import timezone
from django.conf import settings
from django.db.models import Q

def render(request, template, data={}):
  """
  Renders the template for the given request, passing in the provided data.
  Adds extra data attributes common to all templates.
  """

  extra_data = get_extra_context(request)
  extra_data.update(data)
  return shortcuts.render(request, template, extra_data)


def get_extra_context(request):
  """ Returns a dict of the extra context corresponding to the request. """
  is_authenticated = request.user.is_authenticated()

  # fetch all courses this user is in
  if is_authenticated:
    courses_ta = (models.Course.objects.filter(
      Q(courseuser__user=request.user.pk),
      Q(courseuser__privilege=models.CourseUser.INSTRUCTOR) |
      Q(courseuser__privilege=models.CourseUser.TA)
    ).prefetch_related('exam_set'))

    courses_student = (models.Course.objects.filter(
      Q(courseuser__user=request.user.pk),
      Q(courseuser__privilege=models.CourseUser.STUDENT)
    ).prefetch_related('exam_set'))

    user = shortcuts.get_object_or_404(models.User, id=request.user.pk)
    name = user.first_name
  else:
    courses_ta = []
    courses_student = []
    name = ''

  extra_context = {
    'debug': settings.DEBUG,
    'courses_ta': courses_ta,
    'courses_student': courses_student,
    'path': request.path,
    'user': request.user,
    'name': name,
    'is_authenticated': is_authenticated,
    'year': timezone.now().year,
    'is_instructor': is_authenticated and request.user.is_instructor_for_any_course(),
  }

  return extra_context
