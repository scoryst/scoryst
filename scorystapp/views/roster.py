from django import forms as django_forms, http, shortcuts
from scorystapp import models, forms, decorators, utils, serializers
from scorystapp.views import helpers, email_sender
from rest_framework import decorators as rest_decorators, response


@decorators.access_controlled
@decorators.instructor_or_ta_required
def roster(request, cur_course_user):
  """ Allows the instructor to manage a course roster. """
  cur_course = cur_course_user.course

  if request.method == 'POST':
    form = forms.AddPeopleForm(request.POST)

    if form.is_valid():
      people = form.cleaned_data.get('people')
      privilege = form.cleaned_data.get('privilege')

      course_users = []
      for person in people.splitlines():
        first_name, last_name, email, student_id = person.split(',')
        email = email.lower()

        # for each person, find/create a corresponding user
        try:
          user = models.User.objects.get(email=email)
        except models.User.DoesNotExist:
          password = utils.generate_random_string(50)
          user = models.User.objects.create_user(email, first_name, last_name,
            student_id, password)
        else:
          # update existing user's student ID to match entered value
          user.student_id = student_id
          user.save()

        try:
          course_user = models.CourseUser.objects.get(user=user.pk, course=cur_course.pk)
        except models.CourseUser.DoesNotExist:
          # add that user to the course
          course_user = models.CourseUser(user=user, course=cur_course,
            privilege=privilege)
        else:
          # if the user is already in the course, simply update his/her privileges
          course_user.privilege = privilege

        course_user.save()
        course_users.append(course_user)

      email_sender.send_added_to_course_email(request, course_users)
      return shortcuts.redirect(request.path)
  else:
    form = forms.AddPeopleForm()

  course_users = models.CourseUser.objects.filter(course=cur_course.pk)
  return helpers.render(request, 'roster.epy', {
    'title': 'Roster',
    'add_people_form': form,
    'course': cur_course,
    'course_users': course_users,
    'is_instructor': cur_course_user.privilege == models.CourseUser.INSTRUCTOR
  })


@decorators.access_controlled
@decorators.instructor_required
def delete_from_roster(request, cur_course_user, course_user_id):
  """ Allows the instructor to delete a user from the course roster. """
  cur_course = cur_course_user.course
  models.CourseUser.objects.filter(pk=course_user_id, course=cur_course.pk).delete()
  return shortcuts.redirect('/course/%d/roster' % cur_course.pk)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def list_course_users(request, cur_course_user):
  """
  Returns a list of CourseUsers for the course corresponding to the current
  course user.
  """
  course_users = models.CourseUser.objects.filter(course=cur_course_user.course).order_by(
    'user__first_name', 'user__last_name')
  serializer = serializers.CourseUserSerializer(course_users, many=True,
    context={ 'course_user': cur_course_user })

  return response.Response(serializer.data)


@rest_decorators.api_view(['GET', 'PUT'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def manage_course_user(request, cur_course_user, course_user_id):
  """ Manages a single CourseUser by allowing reads/updates. """
  course_user = shortcuts.get_object_or_404(models.CourseUser, pk=course_user_id)

  if request.method == 'GET':
    serializer = serializers.CourseUserSerializer(course_user)
    return response.Response(serializer.data)
  elif request.method == 'PUT':
    if cur_course_user.privilege != models.CourseUser.INSTRUCTOR:
      return response.Response(status=403)
    serializer = serializers.CourseUserSerializer(course_user,
      data=request.DATA, context={ 'course_user': cur_course_user })

    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)
    return response.Response(serializer.errors, status=422)
