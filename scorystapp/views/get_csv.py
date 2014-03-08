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
  
  question_parts = models.QuestionPart.objects.filter(exam=exam).order_by('-question_number')
  if question_parts.count() > 0:
    num_questions  = question_parts[0].question_number
  else:
    num_questions = 0

  fieldnames=['Last Name', 'First Name', 'ID', 'Email', 'Total Score']
  for i in range(num_questions):
    fieldnames.append('Question %d' % (i + 1))

  writer = csv.DictWriter(response, fieldnames=fieldnames)

  exam_answers = models.ExamAnswer.objects.filter(exam=exam, preview=False
    ).order_by('course_user__user__last_name')

  writer.writeheader()
  
  for exam_answer in exam_answers:
    user = exam_answer.course_user.user
    is_entire_exam_graded = exam_answer.is_graded()
    score = exam_answer.get_points()

    if not is_entire_exam_graded:
      score = 'ungraded'

    row = {
      'Last Name': user.last_name, 
      'First Name': user.first_name, 
      'ID': user.student_id, 
      'Email': user.email, 
      'Total Score': score
    }
    for i in range(num_questions):
      if exam_answer.is_question_graded(i + 1):
        row['Question %d' % (i + 1)] = exam_answer.get_question_points(i + 1)
      else:
        row['Question %d' % (i + 1)] = 'ungraded'
    writer.writerow(row)

  return response
