from django import shortcuts, http
from scorystapp import models, forms, decorators, serializers
from scorystapp.views import helpers
from rest_framework import decorators as rest_decorators, response


@decorators.access_controlled
@decorators.instructor_or_ta_required
def grade(request, cur_course_user, exam_answer_id):
  """ Allows an instructor/TA to grade an exam. """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  return helpers.render(request, 'grade.epy', {
    'title': 'Grade',
    'course_user': cur_course_user,
    'course': cur_course_user.course.name,
    'student_name': exam_answer.course_user.user.get_full_name(),
    'solutions_exist': bool(exam_answer.exam.solutions_pdf.name)
  })
  

@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_previous_student(request, cur_course_user, exam_answer_id):
  """
  Given a particular student's exam, returns the grade page for the previous
  student, ordered alphabetically by last name, then first name, then email.
  If there is no previous student, the same student is returned.
  """
  cur_exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  previous_exam_answer = get_offset_student_exam(exam_answer_id, -1)

  return response.Response({
    'student_path': '/course/%d/grade/%d/' % (cur_course_user.course.pk,
      previous_exam_answer.pk),
    'student_name': previous_exam_answer.course_user.user.get_full_name(),
  })


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_next_student(request, cur_course_user, exam_answer_id):
  """
  Given a particular student's exam, returns the grade page for the next
  student, ordered alphabetically by last name, then first name, then email.
  If there is no next student, the same student is returned.
  """
  cur_exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  next_exam_answer = get_offset_student_exam(exam_answer_id, 1)

  return response.Response({
    'student_path': '/course/%d/grade/%d/' % (cur_course_user.course.pk,
      next_exam_answer.pk),
    'student_name': next_exam_answer.course_user.user.get_full_name(),
  })


def get_offset_student_exam(exam_answer_id, offset):
  """
  Gets the exam for the student present at 'offset' from the current student.
  If there is no student at that offset, the student at one of the bounds (0 or last index)
  is returned.
  """
  offset = int(offset)
  exam_answer_id = int(exam_answer_id)

  # Get the exam of the current student
  cur_exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  # Fetch all exam answers
  exam_answers = models.ExamAnswer.objects.filter(exam=cur_exam_answer.exam, preview=False).order_by(
    'course_user__user__first_name', 'course_user__user__last_name', 'course_user__user__email')

  # Calculate the index of the current exam answer
  for cur_index, exam_answer in enumerate(exam_answers.all()):
    if exam_answer_id == exam_answer.id:
      break
  
  total = exam_answers.count()

  # Fetch the index at offset from current, if possible, else return a bound
  if cur_index + offset >= 0 and cur_index + offset < total:
    next_index = cur_index + offset
  elif cur_index + offset < 0:
    next_index = 0
  else:
    next_index = total - 1

  # Get the exam answer correspodning to the index
  next_exam_answer = exam_answers[next_index]
  return next_exam_answer
