from django import shortcuts
from scorystapp import models, decorators
from scorystapp.views import helpers


@decorators.access_controlled
@decorators.student_required
def view_exam(request, cur_course_user, exam_answer_id):
  """
  Intended as the URL for students who are viewing their exam. Renders the same
  grade template.
  """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  return helpers.render(request, 'grade.epy', {
    'title': 'View Exam',
    'course': cur_course_user.course.name,
    'student_name': exam_answer.course_user.user.get_full_name(),
    'is_student_view' : True,
    'solutions_exist': bool(exam_answer.exam.solutions_pdf.name)
  })


@decorators.access_controlled
@decorators.instructor_or_ta_required
def preview_exam(request, cur_course_user, exam_answer_id):
  """
  Intended as the URL for TAs who are previewing the exams they created. 
  Renders the same grade template.
  """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  return helpers.render(request, 'grade.epy', {
    'title': 'Preview Exam',
    'course': cur_course_user.course.name,
    'student_name': exam_answer.course_user.user.get_full_name(),
    'is_preview' : True,
    'course_user': cur_course_user,
    'solutions_exist': bool(exam_answer.exam.solutions_pdf.name)
  })


@decorators.access_controlled
@decorators.instructor_or_ta_required
def edit_created_exam(request, cur_course_user, exam_answer_id):
  """
  Called when the instructor wants to edit his exam. Redirects to creation page
  """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  exam = exam_answer.exam

  return shortcuts.redirect('/course/%d/exams/create/%d/' %
        (cur_course_user.course.pk, exam.pk))


@decorators.access_controlled
@decorators.instructor_or_ta_required
def leave_created_exam(request, cur_course_user, exam_answer_id):
  """
  Called when the instructor is done viewing exam preview. Redirects the user. 
  The exam was already saved so we don't need to save it again.
  """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  exam = exam_answer.exam

  return shortcuts.redirect('/course/%d/exams/' % (cur_course_user.course.pk))
