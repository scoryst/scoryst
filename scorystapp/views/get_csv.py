from django import shortcuts, http
from scorystapp import models, decorators
import csv
from django.utils import timezone


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_csv(request, cur_course_user, assessment_id):
  """
  Returns a csv of the form (last_name, first_name, email, score_in_assignment)
  for each student who took the assignment
  """
  assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)

  # Create the HttpResponse object with the appropriate CSV header.
  response = http.HttpResponse(content_type='text/csv')

  filename = "%s-scores.csv" % assessment.name
  # Replace spaces in the assessment name with dashes and convert to lower case
  filename = filename.replace(' ', '-').lower()

  response['Content-Disposition'] = 'attachment; filename="%s"' % filename

  question_parts = assessment.get_prefetched_question_parts().order_by('-question_number')
  num_questions = assessment.get_num_questions()

  fieldnames=['Last Name', 'First Name', 'ID', 'Email', 'Total Score']
  if hasattr(assessment, 'homework'):
    fieldnames.append('Submission time (PST)')

  for i in range(num_questions):
    fieldnames.append('Question %d' % (i + 1))

  writer = csv.DictWriter(response, fieldnames=fieldnames)

  submissions = assessment.get_prefetched_submissions().order_by('course_user__user__last_name',
    'course_user__user__first_name')

  writer.writeheader()

  for submission in submissions:
    user = submission.course_user.user if submission.course_user else None
    score = submission.points if submission.graded else 'ungraded'

    row = {
      'Last Name': user.last_name if user else 'unmapped',
      'First Name': user.first_name if user else 'unmapped',
      'ID': user.student_id if user else 'unmapped',
      'Email': user.email if user else 'unmapped',
      'Total Score': score
    }

    if hasattr(assessment, 'homework'):
      local_time = timezone.localtime(submission.time)
      row['Submission time (PST)'] = local_time.strftime('%m/%d/%Y %I:%M %p')

    for i in range(num_questions):
      if submission.is_question_graded(i + 1):
        row['Question %d' % (i + 1)] = submission.get_question_points(i + 1)
      else:
        row['Question %d' % (i + 1)] = 'ungraded'
    writer.writerow(row)

  return response
