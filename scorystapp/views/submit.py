from django import shortcuts
from django.core import files
from django.db.models.fields import files as file_fields
from django.utils import timezone
from scorystapp import models, forms, decorators, utils, serializers
from scorystapp.views import helpers
from celery import task as celery
from scorystapp.apis import evangelist
from datetime import datetime
from rest_framework import decorators as rest_decorators, response
import PyPDF2
import os
import shutil
import requests


@decorators.access_controlled
def submit(request, cur_course_user):
  """ Allows students to submit homework. """
  cur_course = cur_course_user.course
  homeworks = models.Homework.objects.filter(course=cur_course).order_by('-id')

  # (option value, option display) tuple for form select field
  homework_choices = [(hw.id, hw.name) for hw in homeworks]

  if request.method == 'POST':
    form = forms.HomeworkUploadForm(homework_choices, request.POST, request.FILES)

    if form.is_valid():
      homework = models.Homework.objects.get(pk=form.cleaned_data['homework_id'])
      homework_file = request.FILES['homework_file']

      submission = _create_submission(homework, cur_course_user, homework_file)
      _create_empty_responses(submission)
      _create_submission_pages.delay(submission)

      return shortcuts.redirect('/course/%s/submit/%d/' %
        (cur_course_user.course.id, submission.pk))
  else:
    form = forms.HomeworkUploadForm(homework_choices)

  submission_set = models.Submission.objects.filter(course_user=
    cur_course_user).select_related('assessment__homework').order_by('-time')
  submission_set = filter(lambda submission:
    hasattr(submission.assessment, 'homework'), submission_set)

  return helpers.render(request, 'submit.epy', {
    'title': 'Submit',
    'course': cur_course,
    'form': form,
    'submission_set': submission_set,
  })


def _create_submission(homework, course_user, pdf_file):
  """
  Creates a PDF submission, by the given user, for the provided homework.
  Returns the Submission object.
  """
  reader = PyPDF2.PdfFileReader(pdf_file)
  page_count = reader.getNumPages()
  pdf_file.seek(0)  # undo work of PyPDF2

  submission = models.Submission(assessment=homework, course_user=course_user,
    page_count=page_count, released=False, preview=False, time=timezone.now())
  submission.pdf.save('homework-pdf', files.File(pdf_file))

  submission.save()
  return submission


def _create_empty_responses(submission):
  """ Creates empty responses for the given submission. """
  question_parts = submission.assessment.questionpart_set.all()
  for qp in question_parts:
    response = models.Response(submission=submission, question_part=qp,
      pages="", grader_comments=None, grader=None, custom_points=None)
    response.save()


@celery.task
def _create_submission_pages(submission):
  """
  Creates submission pages for the given PDF. Employs Evangelist to perform
  PDF -> JPEG conversion.
  """
  random_prefix = utils.generate_random_string(50)
  jpeg_path = 'homework-pages/%s%%d.jpeg' % random_prefix

  small_jpeg_path = 'homework-pages/%s%%d-small.jpeg' % random_prefix
  large_jpeg_path = 'homework-pages/%s%%d-large.jpeg' % random_prefix
  pages_to_save = []

  print 'Preparing submission pages...'

  for page_number in xrange(1, submission.page_count + 1):
    # paths to normal, small, and large JPEGs; these haven't been uploaded yet
    jpeg_path_for_page = jpeg_path % page_number
    jpeg_field = file_fields.ImageFieldFile(instance=None,
      field=file_fields.FileField(), name=jpeg_path_for_page)

    small_jpeg_path_for_page = small_jpeg_path % page_number
    small_jpeg_field = file_fields.ImageFieldFile(instance=None,
      field=file_fields.FileField(), name=small_jpeg_path_for_page)

    large_jpeg_path_for_page = large_jpeg_path % page_number
    large_jpeg_field = file_fields.ImageFieldFile(instance=None,
      field=file_fields.FileField(), name=large_jpeg_path_for_page)

    # prepare all submission pages
    submission_page = models.SubmissionPage(submission=submission,
      page_number=page_number, page_jpeg=jpeg_field, is_blank=False,
      page_jpeg_small=small_jpeg_field, page_jpeg_large=large_jpeg_field)
    pages_to_save.append(submission_page)

  print 'Making request to Evangelist...'
  response_text = evangelist.convert_pdf_to_jpegs(submission.pdf.name,
    jpeg_path, small_jpeg_path, large_jpeg_path)

  print 'Got Evangelist response text: %s' % response_text

  # finalize all submission pages
  for submission_page in pages_to_save:
    submission_page.save()

  print 'Finalized submission pages!'


@decorators.access_controlled
@decorators.student_required
def map_submission(request, cur_course_user, submission_id):
  submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
  assessment = submission.assessment
  question_parts = assessment.questionpart_set.all()

  return helpers.render(request, 'map-submission.epy', {
    'title': 'Map Submission',
    'course': cur_course_user.course,
    'submission': submission,
    'assessment': assessment,
    'question_parts': question_parts,
  })


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.student_required
def get_submission_pages(request, cur_course_user, submission_id):
  submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
  submission_pages = submission.submissionpage_set.order_by('page_number')

  serializer = serializers.SubmissionPageSerializer(submission_pages, many=True)
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.student_required
def get_responses(request, cur_course_user, submission_id):
  submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
  responses = submission.response_set.all()

  serializer = serializers.SubmitResponseSerializer(responses, many=True)
  return response.Response(serializer.data)


@rest_decorators.api_view(['PUT'])
@decorators.access_controlled
@decorators.student_required
def update_response(request, cur_course_user, submission_id, response_id):
  # include both submission and response ID for security
  response_model = shortcuts.get_object_or_404(models.Response,
    submission=int(submission_id), pk=int(response_id))
  serializer = serializers.SubmitResponseSerializer(response_model,
    data=request.DATA)

  if serializer.is_valid():
    serializer.save()
    return response.Response(serializer.data)
  return response.Response(serializer.errors, status=422)
