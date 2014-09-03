from django import shortcuts, http
from scorystapp import models, decorators
import csv
import math
import pytz
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
    fieldnames.append('Late days')

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
      cur_timezone = pytz.timezone(assessment.course.get_timezone_string())
      local_time = timezone.localtime(submission.time, timezone=cur_timezone)
      row['Submission time (PST)'] = local_time.strftime('%m/%d/%Y %I:%M %p')

      diff = submission.time - submission.assessment.homework.soft_deadline
      late_days = diff.total_seconds() / 24.0 / 60.0 / 60.0
      late_days = max(0, math.ceil(late_days))
      row['Late days'] = late_days

    for i in range(num_questions):
      if submission.is_question_graded(i + 1):
        row['Question %d' % (i + 1)] = submission.get_question_points(i + 1)
      else:
        row['Question %d' % (i + 1)] = 'ungraded'
    writer.writerow(row)

  return response


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_overall_csv(request, cur_course_user):
  """
  Returns a csv of the form (last_name, first_name, email, HW1_Score, HW2_Score...)
  for each student who took the assignment
  """
  course = cur_course_user.course
  assessments = models.Assessment.objects.filter(course=course).order_by('id')

  # Create the HttpResponse object with the appropriate CSV header.
  response = http.HttpResponse(content_type='text/csv')

  filename = "%s-scores.csv" % course.name
  # Replace spaces in the course name with dashes and convert to lower case
  filename = filename.replace(' ', '-').lower()

  response['Content-Disposition'] = 'attachment; filename="%s"' % filename

  fieldnames=['Last Name', 'First Name', 'ID', 'Email']
  for assessment in assessments:
    fieldnames.append(assessment.name)
    if hasattr(assessment, 'homework'):
      fieldnames.append('Late days for %s' % assessment.name)

  writer = csv.DictWriter(response, fieldnames=fieldnames)

  course_users = models.CourseUser.objects.filter(course=course,
    privilege=models.CourseUser.STUDENT).order_by('user__last_name', 'user__first_name')

  writer.writeheader()

  for course_user in course_users:
    user = course_user.user

    row = {
      'Last Name': user.last_name,
      'First Name': user.first_name,
      'ID': user.student_id,
      'Email': user.email
    }

    for assessment in assessments:
      submission = models.Submission.objects.filter(course_user=course_user, assessment=assessment, last=True)

      if submission.count() == 0:
        row[assessment.name] = 'Not Found'
      else:
        submission = submission[0]
        row[assessment.name] = submission.points if submission.graded else 'ungraded'

        if hasattr(assessment, 'homework'):
          diff = submission.time - submission.assessment.homework.soft_deadline
          late_days = diff.total_seconds() / 24.0 / 60.0 / 60.0
          late_days = max(0, math.ceil(late_days))

          row['Late days for %s' % assessment.name] = late_days

    writer.writerow(row)

  return response
