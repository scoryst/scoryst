from django import shortcuts, http
from scorystapp import models, forms, decorators, serializers, \
  overview_serializers, raw_sql
from scorystapp.views import helpers, grade_or_view, email_sender
from rest_framework import decorators as rest_decorators, response
import json


@decorators.access_controlled
def grade_overview(request, cur_course_user):
  """ Overview of all of the students' assessments and grades for a particular assessment. """
  return helpers.render(request, 'grade-overview.epy', {
    'title': 'Grade',
    'is_student': cur_course_user.privilege == models.CourseUser.STUDENT
  })


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def get_assessments(request, cur_course_user):
  """ Returns a list of assessments for the current course. """
  cur_course = cur_course_user.course
  assessments = models.Assessment.objects.filter(course=cur_course.pk).order_by('id')
  serializer = overview_serializers.AssessmentSerializer(assessments,
    many=True, context={ 'cur_course_user': cur_course_user })
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_students(request, cur_course_user, assessment_id):
  """
  Returns JSON information about the list of students associated with the
  assessment_id.
  """
  cur_course = cur_course_user.course
  assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)


  student_course_users = models.CourseUser.objects.filter(course=cur_course.pk,
    privilege=models.CourseUser.STUDENT).order_by('user__first_name', 'user__last_name')
  student_course_users = student_course_users.prefetch_related('user')

  submissions = (models.Submission.objects.filter(assessment=assessment, last=True).
    prefetch_related('course_user'))

  # cache num_questions here to avoid repeated db queries in the serializer
  num_questions = assessment.get_num_questions()
  questions_info = {}

  for question_number in range(1, num_questions + 1):
    num_question_parts = (assessment.questionpart_set.
      filter(question_number=question_number).count())
    questions_info[question_number] = (raw_sql.
      get_question_info(submissions, question_number, num_question_parts))

  serializer = overview_serializers.CourseUserGradedSerializer(
    student_course_users, many=True, context={
      'assessment': assessment,
      'submissions': submissions,
      'num_questions': num_questions,
      'cur_course_user': cur_course_user,
      'questions_info': questions_info,
    })

  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def get_self(request, cur_course_user, assessment_id):
  """
  Used by a student to get his/her own course_user info
  """
  assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)
  submissions = models.Submission.objects.filter(assessment=assessment,
    last=True, course_user=cur_course_user)

  num_questions = assessment.get_num_questions()
  questions_info = {}

  for question_number in range(1, num_questions + 1):
    num_question_parts = (assessment.questionpart_set.
      filter(question_number=question_number).count())
    questions_info[question_number] = (raw_sql.
      get_question_info(submissions, question_number, num_question_parts))

  serializer = overview_serializers.CourseUserGradedSerializer(cur_course_user,
    context={
      'assessment': assessment,
      'submissions': submissions,
      'num_questions': num_questions,
      'cur_course_user': cur_course_user,
      'questions_info': questions_info,
    })
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def get_responses(request, cur_course_user, assessment_id, course_user_id):
  """
  Returns the list of responses for the course_user corresponding
  to given assessment. Returns { 'no_mapped_assessment': True } if assessment doesn't exist and
  { 'not_released': True } if a student is trying to access an unreleased assessment.
  """
  if (cur_course_user.privilege == models.CourseUser.STUDENT and
    cur_course_user.id != int(course_user_id)):
    raise http.Http404

  submissions = models.Submission.objects.filter(assessment=assessment_id,
    course_user=course_user_id, preview=False, last=True).order_by('-id')

  if submissions.count() == 0:
    return response.Response({ 'no_mapped_assessment': True })

  submission = submissions[0]

  if cur_course_user.privilege == models.CourseUser.STUDENT and not submission.released:
    return response.Response({ 'not_released': True })

  responses = models.Response.objects.filter(
    submission=submission).order_by('question_part__question_number',
    'question_part__part_number')
  responses = responses.prefetch_related('question_part', 'grader',
    'grader__user', 'question_part__assessment', 'rubrics')

  serializer = serializers.ResponseSerializer(responses, many=True)
  return response.Response(serializer.data)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def release_grades(request, cur_course_user, assessment_id):
  """
  Releases grades to all students to whom grades for the assessment have not been
  released previously.
  """
  assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)
  email_sender.send_assessment_graded_email(request, assessment)
  return http.HttpResponse('')
