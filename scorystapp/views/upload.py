from django import http, shortcuts
from django.core import files
from django.conf import settings
from django.db.models.fields import files as file_fields
from django.views.decorators import csrf
from scorystapp import models, forms, decorators, utils
from scorystapp.views import helpers
from workers import dispatcher
from workers.orchard import client as orchard_client
from celery import task as celery
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
  exams = models.Exam.objects.filter(course=cur_course).order_by('id')
  # Get the exam choices for the select field in the upload template
  exam_choices = [(exam.id, exam.name) for exam in exams]

  if request.method == 'POST':
    form = forms.StudentExamsUploadForm(request.POST, request.FILES, exam_choices=exam_choices)
    if form.is_valid():
      exam = shortcuts.get_object_or_404(models.Exam, pk=form.cleaned_data['exam_name'], course=cur_course)

      # Break the pdf into corresponding student exams using a celery worker
      # Break those pdfs into jpegs and upload them to S3.
      name_prefix = exam.name.replace(' ', '') + utils.generate_random_string(5)
      _break_and_upload(exam, request.FILES['exam_file'], name_prefix)

      # We return to the roster page because the files are still being processed and map exams
      # won't be ready
      return shortcuts.redirect('/course/%s/roster' % (cur_course_user.course.id,))
  else:
    form = forms.StudentExamsUploadForm(exam_choices=exam_choices)

  return helpers.render(request, 'upload.epy', {
    'title': 'Upload',
    'course': cur_course,
    'form': form
  })


def _break_and_upload(exam, handle, name_prefix):
  """
  Breaks and uploads the PDF file specified by handle. Creates a temporary
  file with the given name prefix, and starts an asynchronous break and
  upload job that runs in the background.
  """
  temp_pdf_name = '/tmp/%s.pdf' % name_prefix
  temp_pdf = open(temp_pdf_name, 'w')
  temp_pdf.seek(0)
  temp_pdf.write(handle.read())
  temp_pdf.flush()

  _break_and_upload_task.delay(exam, temp_pdf_name, name_prefix)


@celery.task
def _break_and_upload_task(exam, temp_pdf_name, name_prefix):
  """
  Splits the given PDF into multiple smaller PDFs. Converts these PDFs into
  JPEGs and uploads them to S3 (courtesy of the converter worker).
  """
  entire_pdf = PyPDF2.PdfFileReader(file(temp_pdf_name, 'rb'))
  num_pages = entire_pdf.getNumPages()

  # assume each page has questions on one side and nothing on the other
  num_pages_per_exam = exam.page_count * 2
  num_students = num_pages / num_pages_per_exam

  for cur_student in range(num_students):
    # for each student, create a new pdf
    single_student_pdf = PyPDF2.PdfFileWriter()

    for cur_page in range(num_pages_per_exam):
      page = entire_pdf.pages[cur_student * num_pages_per_exam + cur_page]
      single_student_pdf.addPage(page)

    single_student_pdf.write(open('/tmp/%s%d.pdf' % (name_prefix, cur_student), 'wb'))

  os.remove(temp_pdf_name)
  _create_and_upload_exam_answers(exam, name_prefix, num_pages_per_exam, num_students)


def _create_and_upload_exam_answers(exam, name_prefix, num_pages_per_exam, num_students):
  """
  Associates a JPEG with every ExamAnswerPage. Creates QuestionPartAnswers for each
  student. Runs the PDF -> JPEG converter worker for all student exams, uploading the
  JPEGs to S3.
  """
  NUM_STUDENTS_PER_WORKER = 10
  num_workers = (num_students - 1) / NUM_STUDENTS_PER_WORKER + 1

  threads = []
  question_parts = models.QuestionPart.objects.filter(exam=exam)
  orchard = orchard_client.OrchardClient(settings.ORCHARD_API_KEY)

  for worker in range(num_workers):
    print 'Spawning worker %d' % worker
    offset = worker * NUM_STUDENTS_PER_WORKER
    students = range(offset, min(num_students, offset + NUM_STUDENTS_PER_WORKER))

    jpeg_prefixes = map(lambda student: 'exam-pages/%s' %
      utils.generate_random_string(40), students)
    pdf_paths = []
    exam_answer_ids = []

    for cur_student in students:
      exam_answer = models.ExamAnswer(course_user=None, exam=exam,
        page_count=num_pages_per_exam)
      temp_pdf_name = '/tmp/%s%d.pdf' % (name_prefix, cur_student)
      temp_pdf = file(temp_pdf_name, 'rb')

      exam_answer.pdf.save('new', files.File(temp_pdf))
      exam_answer.save()

      os.remove(temp_pdf_name)
      pdf_paths.append(exam_answer.pdf.name)
      exam_answer_ids.append(exam_answer.id)

      for cur_page in range(num_pages_per_exam):
        # set the JPEG associated with each exam page
        exam_answer_page = models.ExamAnswerPage(exam_answer=exam_answer,
          page_number=cur_page + 1)
        cur_page_num = cur_student * num_pages_per_exam + cur_page

        # below is the JPEG name set by the converter worker
        jpeg_name = '%s%d.jpeg' % (jpeg_prefixes[cur_student - offset], cur_page + 1)
        jpeg_field = file_fields.ImageFieldFile(instance=None,
          field=file_fields.FileField(), name=jpeg_name)

        large_jpeg_name = '%s%d-large.jpeg' % (jpeg_prefixes[cur_student
          - offset], cur_page + 1)
        large_jpeg_field = file_fields.ImageFieldFile(instance=None,
          field=file_fields.FileField(), name=large_jpeg_name)

        exam_answer_page.page_jpeg = jpeg_field
        exam_answer_page.page_jpeg_large = large_jpeg_field
        exam_answer_page.save()

      for question_part in question_parts:
        # create QuestionPartAnswer models for this student
        answer_pages = ''

        for page in question_part.pages.split(','):
          page = int(page)

          # assume each page has questions on one side and nothing on the other
          answer_pages = answer_pages + str(2 * page - 1) + ','

        # remove the trailing comma (,) from the end of answer_pages
        answer_pages = answer_pages[:-1]
        question_part_answer = models.QuestionPartAnswer(question_part=question_part,
          exam_answer=exam_answer, pages=answer_pages)
        question_part_answer.save()

    # TODO: if create_host is called simultaneously by two processes, it fails;
    # we should talk to Orchard about this
    host_name = utils.generate_random_string(20).lower()
    host = orchard.create_host(host_name, 8192)

    # spawn thread to dispatch converter worker
    args = ('converter', host_name, {
      's3': {
        'token': settings.AWS_S3_ACCESS_KEY_ID,
        'secret': settings.AWS_S3_SECRET_ACCESS_KEY,
        'bucket': settings.AWS_STORAGE_BUCKET_NAME,
      },

      'webhook_secret': settings.WEBHOOK_SECRET,
      'webhook_url': settings.SITE_URL + 'set-blank-pages',
      'exam_answer_ids': exam_answer_ids,
      'pdf_paths': pdf_paths,
      'jpeg_prefixes': jpeg_prefixes,
    })

    dispatcher.dispatch_worker.delay(*args)
    # thread = threading.Thread(target=dispatcher.dispatch_worker, args=args)
    # threads.append(thread)

  # [thread.start() for thread in threads]

  # wait until all threads have complete
  # [thread.join() for thread in threads]


@csrf.csrf_exempt
def set_blank_pages(request):
  """
  Processes POST request containing which pages are blank for a given student's
  exam. More specifically, saves `ExamAnswerPage`s with is_blank = True for the
  list of blank pages sent in the request. Requires an authentication key to be
  passed in the request.

  Currently called from Orchard.
  """
  if (request.method == 'POST' and settings.WEBHOOK_SECRET ==
      request.POST['webhook_secret']):
    blank_pages = request.POST['blank_pages']
    exam_answer_id = request.POST['exam_answer_id']

    for page in blank_pages:
      exam_answer_page = shortcuts.get_object_or_404(models.ExamAnswerPage,
        exam_answer=exam_answer_id, page_number=page)
      exam_answer_page.is_blank = True
      exam_answer_page.save()

    return http.HttpResponse(status=200)
  return http.HttpResponse(status=403)
