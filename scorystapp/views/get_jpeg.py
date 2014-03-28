from django import shortcuts, http
from scorystapp import models, decorators
from scorystapp.views import grade


@decorators.access_controlled
@decorators.student_required
def get_exam_jpeg(request, cur_course_user, exam_answer_id, page_number, exam_id=None):
  """
  Redirects to the jpeg corresponding to exam_answer_id and page_number.
  exam_id is optional, since some URLs may capture it and others may not. It is
  captured if in the URL so that the decorator can verify its consistency with
  the exam_answer_id.
  """
  exam_page = shortcuts.get_object_or_404(models.ExamAnswerPage, exam_answer_id=exam_answer_id,
    page_number=page_number)
  return shortcuts.redirect(exam_page.page_jpeg.url)


@decorators.access_controlled
@decorators.student_required
def get_exam_jpeg_large(request, cur_course_user, exam_answer_id, page_number, exam_id=None):
  """
  Redirects to the large jpeg corresponding to exam_answer_id and page_number.
  exam_id is optional, since some URLs may capture it and others may not. It is
  captured if in the URL so that the decorator can verify its consistency with
  the exam_answer_id.
  """
  exam_page = shortcuts.get_object_or_404(models.ExamAnswerPage, exam_answer_id=exam_answer_id,
    page_number=page_number)
  return shortcuts.redirect(exam_page.page_jpeg_large.url)


@decorators.access_controlled
@decorators.student_required
def get_offset_student_jpeg(request, cur_course_user, exam_answer_id, offset, page_number, exam_id=None):
  """
  Redirects to the jpeg corresponding to page_number for the answer present at
  offset from the current exam answer; if we reach either bounds (0 or last exam),
  we return the bound
  """
  # Ensure the exam_answer_id exists
  shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  next_exam_answer = grade.get_offset_student_exam(exam_answer_id, offset)
  return get_exam_jpeg(request, cur_course_user, next_exam_answer.pk, page_number)


@decorators.access_controlled
@decorators.student_required
def get_exam_page_count(request, cur_course_user, exam_answer_id, exam_id=None):
  """ Returns the number of pages in the exam """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  return http.HttpResponse(exam_answer.page_count)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_blank_exam_jpeg(request, cur_course_user, exam_id, page_number):
  """ Redirects to the empty exam jpeg for the provided page number """
  exam_page = shortcuts.get_object_or_404(models.ExamPage, exam_id=exam_id, page_number=page_number)
  return shortcuts.redirect(exam_page.page_jpeg.url)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_blank_exam_jpeg_large(request, cur_course_user, exam_id, page_number):
  """ Redirects to the empty large exam jpeg for the provided page number """
  exam_page = shortcuts.get_object_or_404(models.ExamPage, exam_id=exam_id, page_number=page_number)
  return shortcuts.redirect(exam_page.page_jpeg_large.url)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_blank_exam_page_count(request, cur_course_user, exam_id):
  """ Returns the number of pages in the exam """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  return http.HttpResponse(exam.page_count)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_offset_student_jpeg_with_question_number(request, cur_course_user, exam_answer_id, offset, question_number, part_number):
  """
  Gets the jpeg corresponding to question_number and part_number for the student
  present at 'offset' from the current student. If there is no student at that
  offset, the student at one of the bounds (0 or last index) is returned.
  """
  # Ensure the exam_answer_id exists
  shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  next_exam_answer = grade.get_offset_student_exam(exam_answer_id, offset)
  # Get the question_part_answer to find which page question_number and part_number lie on
  question_part = shortcuts.get_object_or_404(models.QuestionPart, exam=next_exam_answer.exam,
    question_number=question_number,part_number=part_number)
  question_part_answer = shortcuts.get_object_or_404(models.QuestionPartAnswer,
    exam_answer=next_exam_answer, question_part=question_part)

  return get_exam_jpeg(request, cur_course_user, next_exam_answer.pk, 
    int(question_part_answer.pages.split(',')[0]))
