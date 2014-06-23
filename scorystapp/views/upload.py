from django import http, shortcuts
from django.core import files
from django.conf import settings
from django.db.models.fields import files as file_fields
from django.views.decorators import csrf
from scorystapp import models, forms, decorators, utils, serializers
from scorystapp.views import helpers
from workers import dispatcher
from celery import task as celery
from rest_framework import decorators as rest_decorators, response
import json
import sys
import numpy
import os
import PyPDF2
import shlex
import subprocess
import threading
import time


@decorators.access_controlled
@decorators.instructor_or_ta_required
def upload(request, cur_course_user):
  """
  Shows the form to upload the student exams pdf. Once submitted, processes the pdf,
  splits it and takes the instructor/TA to the map exam page.
  """
  cur_course = cur_course_user.course
  exams = models.Exam.objects.filter(course=cur_course).order_by('-id')
  # Get the exam choices for the select field in the upload template
  exam_choices = [(exam.id, exam.name) for exam in exams]

  if request.method == 'POST':
    form = forms.ExamsUploadForm(exam_choices, request.POST, request.FILES)
    if form.is_valid():
      exam = shortcuts.get_object_or_404(models.Exam, pk=form.cleaned_data['exam_id'], course=cur_course)

      # Breaks the pdf into jpegs and uploads them to S3 after creating `SplitPage` objects
      name_prefix = exam.name.replace(' ', '') + utils.generate_random_string(5)
      _upload_and_split(exam, request.FILES['exam_file'], name_prefix)

      # redirect back to the upload page, which will show upload progress
      return shortcuts.redirect('/course/%s/upload/' % (cur_course_user.course.id,))
  else:
    form = forms.ExamsUploadForm(exam_choices)

  return helpers.render(request, 'upload.epy', {
    'title': 'Upload',
    'course': cur_course,
    'form': form,
  })


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_split_pages(request, cur_course_user, exam_id):
  """ Returns the unassigned exam answer pages for the given exam. """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  pages = models.SplitPage.objects.filter(split__exam=exam_id)

  return response.Response({
    'num_total_pages': pages.count(),
    'num_uploaded_pages': pages.filter(is_uploaded=True).count(),
  })


def _upload_and_split(exam, handle, name_prefix):
  """
  Uploads the PDF file specified by handle. Creates a temporary
  file with the given name prefix, and starts an asynchronous split and
  upload job that runs in the background.
  """
  temp_pdf_name = '/tmp/%s.pdf' % name_prefix
  temp_pdf = open(temp_pdf_name, 'w')
  temp_pdf.seek(0)
  temp_pdf.write(handle.read())
  temp_pdf.flush()

  _upload_and_split_task.delay(exam, temp_pdf_name)


@celery.task
def _upload_and_split_task(exam, temp_pdf_name):
  """
  Creates a 'Split' object and uploads the giant PDF file. Converts the PDF
  into JPEGs and uploads them to S3 (courtesy of the converter worker).
  """
  entire_pdf_file = file(temp_pdf_name, 'rb')
  entire_pdf = PyPDF2.PdfFileReader(entire_pdf_file)
  num_pages = entire_pdf.getNumPages()

  split = models.Split(exam=exam, secret=utils.generate_random_string(40))
  split.pdf.save('new', files.File(entire_pdf_file))
  split.save()

  # assume each page has questions on one side and nothing on the other
  num_pages_per_exam = exam.page_count * 2

  os.remove(temp_pdf_name)
  _create_and_upload_split_pages(split, num_pages, num_pages_per_exam)


def _create_and_upload_split_pages(split, num_pages, num_pages_per_exam):
  """
  For each page in the pdf, create a `SplitPage` and associated a JPEG with it.
  Runs the PDF -> JPEG converter worker for all pages, uploading the
  JPEGs to S3.
  """
  NUM_PAGES_PER_WORKER = 200
  num_workers = (num_pages - 1) / NUM_PAGES_PER_WORKER + 1

  for worker in range(num_workers):
    print 'Spawning worker %d' % worker
    offset = worker * NUM_PAGES_PER_WORKER
    pages = range(offset, min(num_pages, offset + NUM_PAGES_PER_WORKER))

    jpeg_prefixes = map(lambda student: 'split-pages/%s' %
      utils.generate_random_string(40), pages)

    for page in pages:
      # We make a guess for `begins_exam_answer` by assuming all the exams
      # uploaded have the correct number of pages
      split_page = models.SplitPage(split=split, page_number=page + 1,
      begins_exam_answer=(page % num_pages_per_exam == 0))

      jpeg_name = '%s.jpeg' % jpeg_prefixes[page - offset]
      jpeg_field = file_fields.ImageFieldFile(instance=None,
        field=file_fields.FileField(), name=jpeg_name)

      small_jpeg_name = '%s-small.jpeg' % jpeg_prefixes[page - offset]
      small_jpeg_field = file_fields.ImageFieldFile(instance=None,
        field=file_fields.FileField(), name=small_jpeg_name)

      large_jpeg_name = '%s-large.jpeg' % jpeg_prefixes[page - offset]
      large_jpeg_field = file_fields.ImageFieldFile(instance=None,
        field=file_fields.FileField(), name=large_jpeg_name)

      split_page.page_jpeg = jpeg_field
      split_page.page_jpeg_small = small_jpeg_field
      split_page.page_jpeg_large = large_jpeg_field
      split_page.save()

    dp = dispatcher.Dispatcher()

    # spawn thread to dispatch converter worker
    payload = {
      's3': {
        'token': settings.AWS_S3_ACCESS_KEY_ID,
        'secret': settings.AWS_S3_SECRET_ACCESS_KEY,
        'bucket': settings.AWS_STORAGE_BUCKET_NAME,
      },

      'webhook_data': {
        'split_id': split.id,
        'secret': split.secret
      },

      'webhook_url': settings.SITE_URL + 'update-split-page-state/',
      'pdf_path': split.pdf.name,
      'jpeg_prefixes': jpeg_prefixes,
      'page_start': pages[0],
      'page_end': pages[-1]
    }

    instance_options = {'instance_type': 'm3.medium'}
    dispatch_worker.delay(dp, 'converter', payload, instance_options)


@celery.task
def dispatch_worker(dp, *args):
  """ Proxy for dispatcher.run(). """
  response = dp.run(*args)
  print response.text
  print 'Done!'


@csrf.csrf_exempt
def update_split_page_state(request):
  """
  Processes POST request telling us which `SplitPage` has been uploaded
  and whether or not it is blank.
  Currently called from Orchard.
  """
  if request.method == 'POST':
    params = json.loads(request.body)
    split_id = params['webhook_data']['split_id']
    secret = params['webhook_data']['secret']

    # If the split is found, we are authenticated because of the secret
    split = shortcuts.get_object_or_404(models.Split, id=split_id, secret=secret)

    # Expects `page_number` to be 0 indexed
    page_number = params['page_number']
    is_blank = params['is_blank']

    split_page = shortcuts.get_object_or_404(models.SplitPage,
      split=split, page_number=page_number + 1)

    split_page.is_uploaded = True
    split_page.is_blank = is_blank
    split_page.save()

    return http.HttpResponse(status=200)
  return http.HttpResponse(status=403)
