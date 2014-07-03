from django import shortcuts, http
from scorystapp import models, decorators
from scorystapp.views import grade
from django.db.models import Q


@decorators.access_controlled
@decorators.student_required
def get_assessment_jpeg(request, cur_course_user, submission_id, page_number, assessment_id=None):
  """
  Redirects to the jpeg corresponding to submission_id and page_number.
  assessment_id is optional, since some URLs may capture it and others may not. It is
  captured if in the URL so that the decorator can verify its consistency with
  the submission_id.
  """
  assessment_page = shortcuts.get_object_or_404(models.SubmissionPage, submission_id=submission_id,
    page_number=page_number)
  return shortcuts.redirect(assessment_page.page_jpeg.url)


@decorators.access_controlled
@decorators.student_required
def get_assessment_jpeg_large(request, cur_course_user, submission_id, page_number, assessment_id=None):
  """
  Redirects to the large jpeg corresponding to submission_id and page_number.
  assessment_id is optional, since some URLs may capture it and others may not. It is
  captured if in the URL so that the decorator can verify its consistency with
  the submission_id.
  """
  assessment_page = shortcuts.get_object_or_404(models.SubmissionPage, submission_id=submission_id,
    page_number=page_number)
  return shortcuts.redirect(assessment_page.page_jpeg_large.url)


@decorators.access_controlled
@decorators.student_required
def get_offset_student_jpeg(request, cur_course_user, submission_id, offset,
    page_number, assessment_id=None):
  """
  Redirects to the jpeg corresponding to page_number for the answer present at
  offset from the current submission; if we reach either bounds (0 or last assessment),
  we return the bound
  """
  # Ensure the submission_id exists
  shortcuts.get_object_or_404(models.Submission, pk=submission_id)

  next_submission = grade.get_offset_student_assessment(submission_id, offset)
  assessment_page = shortcuts.get_object_or_404(models.SubmissionPage, submission=next_submission,
    page_number=page_number)
  return shortcuts.redirect(assessment_page.page_jpeg.url)


@decorators.access_controlled
@decorators.student_required
def get_assessment_page_count(request, cur_course_user, submission_id, assessment_id=None):
  """ Returns the number of pages in the assessment """
  submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
  return http.HttpResponse(submission.page_count)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_blank_assessment_jpeg(request, cur_course_user, assessment_id, page_number):
  """ Redirects to the empty assessment jpeg for the provided page number """
  assessment_page = shortcuts.get_object_or_404(models.AssessmentPage, assessment_id=assessment_id,
    page_number=page_number)
  return shortcuts.redirect(assessment_page.page_jpeg.url)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_blank_assessment_jpeg_large(request, cur_course_user, assessment_id, page_number):
  """ Redirects to the empty large assessment jpeg for the provided page number """
  assessment_page = shortcuts.get_object_or_404(models.AssessmentPage, assessment_id=assessment_id,
    page_number=page_number)
  return shortcuts.redirect(assessment_page.page_jpeg_large.url)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_blank_assessment_page_count(request, cur_course_user, assessment_id):
  """ Returns the number of pages in the assessment """
  assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)
  return http.HttpResponse(assessment.page_count)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_offset_student_jpeg_with_question_number(request, cur_course_user,
    submission_id, offset, question_number):
  """
  Gets the jpeg corresponding to question_number and part_number for the student
  present at 'offset' from the current student. If there is no student at that
  offset, the student at one of the bounds (0 or last index) is returned.
  """
  # Ensure the submission_id exists
  shortcuts.get_object_or_404(models.Submission, pk=submission_id)
  next_submission = grade.get_offset_student_assessment(submission_id, offset)

  page = _get_closest_page(next_submission, question_number)
  assessment_page = shortcuts.get_object_or_404(models.SubmissionPage,
    submission=next_submission, page_number=page)
  return shortcuts.redirect(assessment_page.page_jpeg.url)


@decorators.access_controlled
@decorators.student_required
def get_closest_page(request, cur_course_user, submission_id, question_number):
  """ Returns the closest page for the given question of the submission. """
  submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
  page = _get_closest_page(submission, question_number)
  return http.HttpResponse(page)


def _get_closest_page(submission, question_number):
  """
  Gets the closest page for the given question of the submission. The closest
  page is defined as follows:

  - If the current question has a part one, and that part one has pages, return
    its first page
  - Else, consider all parts of the current question, and return the first page
    from the first part that has pages
  - If none of those parts have pages, take the previous question, and return
    the last page from the last part that has pages.
  """
  question_number = int(question_number)
  page = _find_page_for_question(submission, question_number, earliest=True)

  if page == None:
    # couldn't find a page for the current question; try the previous one
    page = _find_page_for_question(submission, question_number - 1,
      earliest=False)

  if page == None:
    # couldn't find a page for the current or previous question; go to
    # first page of submission
    page = 1

  return page


def _find_page_for_question(submission, question_number, earliest=True):
  """
  Finds the page number of the response for the given question in the provided
  submission. If earliest is True, returns the earliest page that contains the
  response. Otherwise, returns the latest page that contains the response.
  """
  assessment = submission.assessment
  question_parts = assessment.questionpart_set.filter(
    question_number=question_number)

  if earliest:
    question_parts = question_parts.order_by('part_number')
  else:
    question_parts = question_parts.order_by('-part_number')

  if len(question_parts) == 0:
    return None

  responses = models.Response.objects.filter(Q(submission=submission,
    question_part__in=question_parts), ~Q(pages=None), ~Q(pages=''))

  # order responses based on earliest or latest question part
  question_part_cases = map(lambda (i, qp): 'when question_part_id=%d then %d' %
    (qp.pk, i), enumerate(question_parts))
  responses = responses.extra(select={'manual': 'case %s end' %
    ' '.join(question_part_cases)}, order_by=['manual'])

  if len(responses) == 0:
    return None

  pages = responses[0].pages
  pages = pages.split(',')

  if earliest:
    return pages[0]
  else:
    return pages[-1]
