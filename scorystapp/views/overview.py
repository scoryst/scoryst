from django import shortcuts, http
from scorystapp import models, forms, decorators, serializers, overview_serializers
from scorystapp.views import helpers, grade_or_view, send_email
from rest_framework import decorators as rest_decorators, response
import json


@decorators.access_controlled
def grade_overview(request, cur_course_user):
  """ Overview of all of the students' exams and grades for a particular exam. """
  return helpers.render(request, 'grade-overview.epy', {
    'title': 'Exams',
    'is_student': cur_course_user.privilege == models.CourseUser.STUDENT
  })


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def get_exams(request, cur_course_user):
  """ Returns a list of exams for the current course. """
  cur_course = cur_course_user.course
  exams = models.Exam.objects.filter(course=cur_course.pk).order_by('id')
  serializer = overview_serializers.ExamSerializer(exams, many=True)
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_students(request, cur_course_user, exam_id):
  """
  Returns JSON information about the list of students associated with the
  exam id.
  """
  cur_course = cur_course_user.course
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)

  student_course_users = models.CourseUser.objects.filter(course=cur_course.pk,
    privilege=models.CourseUser.STUDENT).order_by('user__first_name', 'user__last_name')

  # TODO: not a good idea if students have a lot of exams, but it works really well for now
  student_course_users = student_course_users.prefetch_related(
    'user',
    'examanswer_set',
    'examanswer_set__questionpartanswer_set',
    'examanswer_set__questionpartanswer_set__rubrics',
    'examanswer_set__questionpartanswer_set__question_part',
    'examanswer_set__questionpartanswer_set__exam_answer__exam',
    'examanswer_set__questionpartanswer_set__grader__user'
  )

  # cache num_questions here to avoid repeated db queries in the serializer
  num_questions = exam.get_num_questions()
  serializer = overview_serializers.CourseUserGradedSerializer(student_course_users, many=True,
    context={'exam': exam, 'num_questions': num_questions})
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def get_self(request, cur_course_user, exam_id):
  """
  Used by a student to get his/her own course_user info
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  serializer = overview_serializers.CourseUserGradedSerializer(cur_course_user,
    context={ 'exam': exam })
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def get_question_part_answers(request, cur_course_user, exam_id, course_user_id):
  """
  Returns the list of question_part_answers for the course_user corresponding
  to given exam. Returns { 'no_mapped_exam': True } if exam doesn't exist and
  { 'not_released': True } if a student is trying to access an unreleased exam.
  """
  if (cur_course_user.privilege == models.CourseUser.STUDENT and
    cur_course_user.id != int(course_user_id)):
    raise http.Http404

  try:
    exam_answer = models.ExamAnswer.objects.get(exam=exam_id, course_user=course_user_id,
      preview=False)
  except models.ExamAnswer.DoesNotExist:
    return response.Response({ 'no_mapped_exam': True })

  if cur_course_user.privilege == models.CourseUser.STUDENT and not exam_answer.released:
    return response.Response({ 'not_released': True })

  question_part_answers = models.QuestionPartAnswer.objects.filter(
    exam_answer=exam_answer).order_by('question_part__question_number',
    'question_part__part_number')
  serializer = serializers.QuestionPartAnswerSerializer(question_part_answers,
    many=True)

  return response.Response(serializer.data)


@decorators.access_controlled
@decorators.instructor_required
def release_grades(request, cur_course_user, exam_id):
  """
  Releases grades to all students to whom grades for the exam have not been
  released previously.
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  send_email.send_exam_graded_email(request, exam)
  return http.HttpResponse('')
