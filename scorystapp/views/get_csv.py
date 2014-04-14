from django import shortcuts, http
from scorystapp import models, decorators
import csv


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_csv(request, cur_course_user, exam_id):
  """
  Returns a csv of the form (last_name, first_name, email, score_in_exam)
  for each student who took the exam
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)

  # Create the HttpResponse object with the appropriate CSV header.
  response = http.HttpResponse(content_type='text/csv')

  filename = "%s-scores.csv" % exam.name
  # Replace spaces in the exam name with dashes and convert to lower case
  filename = filename.replace(' ', '-').lower()

  response['Content-Disposition'] = 'attachment; filename="%s"' % filename

  question_parts = exam.get_prefetched_question_parts().order_by('-question_number')
  num_questions = exam.get_num_questions()

  fieldnames=['Last Name', 'First Name', 'ID', 'Email', 'Total Score']
  for i in range(num_questions):
    fieldnames.append('Question %d' % (i + 1))

  writer = csv.DictWriter(response, fieldnames=fieldnames)

  exam_answers = exam.get_prefetched_exam_answers().prefetch_related(
    'course_user__user').order_by('course_user__user__last_name',
    'course_user__user__first_name')

  writer.writeheader()

  for exam_answer in exam_answers:
    user = exam_answer.course_user.user if exam_answer.course_user else None
    score = exam_answer.get_points() if exam_answer.is_graded() else 'ungraded'

    row = {
      'Last Name': user.last_name if user else 'unmapped',
      'First Name': user.first_name if user else 'unmapped',
      'ID': user.student_id if user else 'unmapped',
      'Email': user.email if user else 'unmapped',
      'Total Score': score
    }
    for i in range(num_questions):
      if exam_answer.is_question_graded(i + 1):
        row['Question %d' % (i + 1)] = exam_answer.get_question_points(i + 1)
      else:
        row['Question %d' % (i + 1)] = 'ungraded'
    writer.writerow(row)

  return response
