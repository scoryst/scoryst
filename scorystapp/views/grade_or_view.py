from django import shortcuts, http
from scorystapp import models, decorators, serializers
import json
from rest_framework import decorators as rest_decorators, response


@decorators.access_controlled
@decorators.student_required
def get_exam_solutions_pdf(request, cur_course_user, exam_answer_id):
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  return shortcuts.redirect(exam_answer.exam.solutions_pdf.url)


@decorators.access_controlled
@decorators.student_required
def get_exam_pdf(request, cur_course_user, exam_answer_id):
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  return shortcuts.redirect(exam_answer.pdf.url)


# TODO: confirm security is OK for the API methods below
@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.student_required
def list_question_part_answers(request, cur_course_user, exam_answer_id):
  """ Returns a list of QuestionPartAnswers for the provided Exam. """
  question_part_answers = models.QuestionPartAnswer.objects.filter(
    exam_answer=exam_answer_id).order_by('question_part__question_number',
    'question_part__part_number')
  serializer = serializers.QuestionPartAnswerSerializer(question_part_answers,
    many=True)

  return response.Response(serializer.data)


@rest_decorators.api_view(['GET', 'PUT'])
@decorators.access_controlled
@decorators.student_required
def manage_question_part_answer(request, cur_course_user, exam_answer_id,
    question_part_answer_id):
  """ Manages a single QuestionPartAnswer by allowing reads/updates. """
  question_part_answer = shortcuts.get_object_or_404(models.QuestionPartAnswer,
    pk=question_part_answer_id)

  if request.method == 'GET':
    serializer = serializers.QuestionPartAnswerSerializer(question_part_answer)
    return response.Response(serializer.data)
  elif request.method == 'PUT':
    # user must be an instructor/TA
    if cur_course_user.privilege == models.CourseUser.STUDENT:
      return response.Response(status=403)

    context = {
      'user': request.user,
      'course_user': cur_course_user
    }

    # user wants to update a question answer
    serializer = serializers.QuestionPartAnswerSerializer(question_part_answer,
      data=request.DATA, context=context)

    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)
    return response.Response(serializer.errors, status=422)


@rest_decorators.api_view(['GET', 'POST'])
@decorators.access_controlled
@decorators.student_required
def list_rubrics(request, cur_course_user, exam_answer_id, question_part_answer_id):
  """ Returns a list of Rubrics for the given QuestionPartAnswer. """
  question_part_answer = shortcuts.get_object_or_404(models.QuestionPartAnswer,
    pk=question_part_answer_id)

  if request.method == 'GET':
    rubrics = models.Rubric.objects.filter(
      question_part=question_part_answer.question_part.pk).order_by('id')

    serializer = serializers.RubricSerializer(rubrics, many=True)
    return response.Response(serializer.data)
  elif request.method == 'POST':
    # if user wants to update a rubric, must be an instructor/TA
    if cur_course_user.privilege == models.CourseUser.STUDENT:
      return response.Response(status=403)

    serializer = serializers.RubricSerializer(data=request.DATA, context={
      'question_part': question_part_answer.question_part })
    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)

    return response.Response(serializer.errors, status=422)


@rest_decorators.api_view(['GET', 'PUT', 'DELETE'])
@decorators.access_controlled
@decorators.student_required
def manage_rubric(request, cur_course_user, exam_answer_id, question_part_answer_id, rubric_id):
  """ Manages a single Rubric by allowing reads/updates. """
  question_part_answer = shortcuts.get_object_or_404(models.QuestionPartAnswer,
    pk=question_part_answer_id)
  rubric = shortcuts.get_object_or_404(models.Rubric, question_part=question_part_answer.
    question_part.pk, pk=rubric_id)

  if request.method == 'GET':
    serializer = serializers.RubricSerializer(rubric)
    return response.Response(serializer.data)
  elif request.method == 'PUT':
    # if user wants to update a rubric, must be an instructor/TA
    if cur_course_user.privilege == models.CourseUser.STUDENT:
      return response.Response(status=403)

    serializer = serializers.RubricSerializer(rubric, data=request.DATA, context={
      'question_part': question_part_answer.question_part })
    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)

    return response.Response(serializer.errors, status=422)
  elif request.method == 'DELETE':
    rubric.delete()
    return response.Response(status=204)


@rest_decorators.api_view(['GET', 'POST'])
@decorators.access_controlled
@decorators.student_required
def list_annotations(request, cur_course_user, exam_answer_id, question_part_answer_id, exam_page_number):
  """ Returns a list of Annotations for the provided Exam and QuestionPartAnswer """
  question_part_answer = shortcuts.get_object_or_404(models.QuestionPartAnswer, pk=question_part_answer_id)
  exam_answer_page = shortcuts.get_object_or_404(models.ExamAnswerPage,
    exam_answer=exam_answer_id, page_number=int(exam_page_number))

  if request.method == 'GET':
    annotations = models.Annotation.objects.filter(exam_answer_page=exam_answer_page,
      question_part_answer=question_part_answer)
    serializer = serializers.AnnotationSerializer(annotations, many=True)

    return response.Response(serializer.data)
  elif request.method == 'POST':
    request.DATA['exam_answer_page'] = exam_answer_page.pk

    # Get these objects to be validated in the serializer methods against those
    # in the PUT/POST body i.e. in request.DATA. The context
    # question_part_answer is already validated against the exam_answer and
    # cur_course_user from the decorator. The request.DATA exam_answer_page is
    # already validated, since otherwise getting the object would 404.
    serializer = serializers.AnnotationSerializer(data=request.DATA, context={
      'question_part_answer': question_part_answer, 'exam_answer_page': exam_answer_page })
    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)
    return response.Response(serializer.errors, status=422)


@rest_decorators.api_view(['GET', 'PUT', 'DELETE'])
@decorators.access_controlled
@decorators.student_required
def manage_annotation(request, cur_course_user, exam_answer_id, question_part_answer_id, exam_page_number, annotation_id):
  """ Manages a single Annotation by allowing reads/updates. """
  annotation = shortcuts.get_object_or_404(models.Annotation, pk=annotation_id)
  if request.method == 'GET':
    serializer = serializers.AnnotationSerializer(annotation)
    return response.Response(serializer.data)

  elif request.method == 'PUT' or request.method == 'POST':
    if cur_course_user.privilege == models.CourseUser.STUDENT:
      return response.Response(status=403)

    # Get these objects to be validated in the serializer methods against those
    # in the PUT/POST body i.e. in request.DATA. The context
    # question_part_answer is already validated against the exam_answer and
    # cur_course_user from the decorator.
    question_part_answer = shortcuts.get_object_or_404(models.QuestionPartAnswer, pk=question_part_answer_id)
    exam_answer_page = shortcuts.get_object_or_404(models.ExamAnswerPage,
      exam_answer=exam_answer_id, page_number=int(exam_page_number))

    serializer = serializers.AnnotationSerializer(annotation, data=request.DATA, context={
      'question_part_answer': question_part_answer, 'exam_answer_page': exam_answer_page })
    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)
    return response.Response(serializer.errors, status=422)

  elif request.method == 'DELETE':
    if cur_course_user.privilege == models.CourseUser.STUDENT:
      return response.Response(status=403)
    annotation.delete()
    return response.Response(status=204)
