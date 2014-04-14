from django import shortcuts, http
from scorystapp import models, decorators, assign_serializers
from scorystapp.views import helpers, grade, grade_or_view
from rest_framework import decorators as rest_decorators, response
import json


@decorators.access_controlled
@decorators.instructor_or_ta_required
def assign(request, cur_course_user, exam_id, exam_answer_id=None):
  """ Renders the assign exams page """
  # If no exam_answer_id is given, show the first exam_answer
  if exam_answer_id is None:
    exam_answers = models.ExamAnswer.objects.filter(exam_id=exam_id, preview=False)
    if not exam_answers.count() == 0:
      exam_answer_id = exam_answers[0].id
      return shortcuts.redirect('/course/%s/exams/%s/assign/%s/' %
        (cur_course_user.course.id, exam_id, exam_answer_id))
    else:
      raise http.Http404

  return helpers.render(request, 'assign.epy', {'title': 'Assign Exam Answers'})


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_students(request, cur_course_user, exam_id):
  """
  Returns a list of students for the current exam. Includes whether each student
  has been assigned or not.
  """
  cur_course = cur_course_user.course
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  course_users = models.CourseUser.objects.filter(course=cur_course.pk,
    privilege=models.CourseUser.STUDENT).order_by('id')

  serializer = assign_serializers.CourseUserSerializer(course_users, many=True,
    context={ 'exam': exam })
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def list_exam_answers(request, cur_course_user, exam_id):
  """ Lists all the exam answers associated with the given exam """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  exam_answers = models.ExamAnswer.objects.filter(exam=exam, preview=False).order_by('id')

  serializer = assign_serializers.ExamAnswerSerializer(exam_answers, many=True,
    context={ 'exam': exam })
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET', 'PUT'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def manage_exam_answer(request, cur_course_user, exam_id, exam_answer_id):
  """ Updates a single `exam_answer` """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  if request.method == 'GET':
    serializer = assign_serializers.ExamAnswerSerializer(exam_answer,
      context={ 'exam': exam_answer.exam })
    return response.Response(serializer.data)
  elif request.method == 'PUT':
    serializer = assign_serializers.ExamAnswerSerializer(exam_answer,
      data=request.DATA, context={ 'exam': exam_answer.exam })

    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)
    return response.Response(serializer.errors, status=422)
