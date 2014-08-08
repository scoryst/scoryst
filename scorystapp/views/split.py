from django import shortcuts, http
from django.core import files
from scorystapp import models, decorators, split_serializers, utils
from scorystapp.views import helpers
from celery import task as celery
from rest_framework import decorators as rest_decorators, response
import json
import urllib2
import os
import PyPDF2


@decorators.access_controlled
@decorators.instructor_or_ta_required
def split(request, cur_course_user, exam_id):
  """ Renders the split exams page """
  return helpers.render(request, 'split.epy', {'title': 'Split into Exam Answers'})


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_pages(request, cur_course_user, exam_id):
  """ Returns all the pages that have been uploaded (but not split) for the given exam """
  split_pages = models.SplitPage.objects.filter(split__exam=exam_id, is_blank=False).order_by('split',
    'page_number')

  serializer = split_serializers.SplitPageSerializer(split_pages, many=True)
  return response.Response(serializer.data)


@rest_decorators.api_view(['GET', 'PUT'])
@decorators.access_controlled
@decorators.instructor_or_ta_required
def update_split_page(request, cur_course_user, exam_id, split_page_id):
  """ Updates a particular split page """
  split_page = shortcuts.get_object_or_404(models.SplitPage, pk=split_page_id)

  if request.method == 'GET':
    serializer = split_serializers.SplitPageSerializer(split_page)
    return response.Response(serializer.data)
  elif request.method == 'PUT':
    serializer = split_serializers.SplitPageSerializer(split_page, data=request.DATA)

    if serializer.is_valid():
      serializer.save()
      return response.Response(serializer.data)
    return response.Response(serializer.errors, status=422)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def finish_and_create_submissions(request, cur_course_user, exam_id):
  """ Once splitting is finished, create the `submission`s """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  split_pages = models.SplitPage.objects.filter(split__exam=exam).order_by('split', 'page_number')
  num_pages_in_exam = 0
  submission = None
  question_parts = models.QuestionPart.objects.filter(assessment=exam)

  # pdf_info_list will be used to create the pdfs for each student
  pdf_info_list = []
  for split_page in split_pages:
    if split_page.begins_submission:
      # Save the previous exam, if it isn't the first one
      if submission:
        submission.page_count = num_pages_in_exam
        submission.save()
        _create_responses(question_parts, submission, split_page.is_single)

      num_pages_in_exam = 0
      # `page_count` will be set later
      submission = models.Submission(course_user=None, assessment=exam, page_count=0)
      # Fake the PDF in order to save, we'll fix it soon
      submission.pdf = 'none'
      submission.save()

      pdf_info = {
        'submission_id': submission.id,
        'pages': []
      }
      pdf_info_list.append(pdf_info)

    if submission:
      num_pages_in_exam += 1
      submission_page = models.SubmissionPage(submission=submission,
        page_number=num_pages_in_exam, is_blank=split_page.is_blank,
        page_jpeg=split_page.page_jpeg, page_jpeg_large=split_page.page_jpeg_large)
      submission_page.save()

      pdf_info['pages'].append((split_page.page_number, split_page.split.pdf.url))

  # TODO: Get back and clean the fence post problem
  if submission:
    submission.page_count = num_pages_in_exam
    submission.save()
    _create_responses(question_parts, submission, split_page.is_single)

  _upload_pdf_for_submissions.delay(pdf_info_list)

  # Delete all splits since we have taken care of them
  models.Split.objects.filter(exam=exam).delete()
  return shortcuts.redirect('/course/%d/assessments/%d/assign/'
    % (cur_course_user.course.pk, int(exam_id)))


def _create_responses(question_parts, submission, is_single):
  """
  Creates `Response` models for this `submission` and sets
  the correct answer pages for it
  """
  for question_part in question_parts:
    answer_pages = ''

    for page in question_part.pages.split(','):
      page = int(page)

      if is_single:
        if page < submission.page_count:
          answer_pages = answer_pages + str(page) + ','
        elif answer_pages == '':
          answer_pages = str(submission.page_count) + ','
      else:
        # When the PDF of the exam was uploaded, we assumed it had no blank
        # pages whereas there were blank pages during upload. Hence, the 2x - 1
        if 2 * page - 1 <= submission.page_count:
          answer_pages = answer_pages + str(2 * page - 1) + ','
        elif answer_pages == '':
          # If the page is out of bounds, and we have no pages associated
          # with this question part, the last page is our best guess.
          answer_pages = str(submission.page_count) + ','
          break

    # remove the trailing comma (,) from the end of answer_pages
    answer_pages = answer_pages[:-1]
    response = models.Response(question_part=question_part,
      submission=submission, pages=answer_pages)
    response.save()


@celery.task
def _upload_pdf_for_submissions(pdf_info_list):
  """ For each `submission`, create a pdf file and upload it to S3 """
  cur_url = None
  temp_pdf_name = '/tmp/%s.pdf' % utils.generate_random_string(20)
  # a + b so file is opened for read/write in binary and is created if it didn't
  # exist before
  temp_pdf = open(temp_pdf_name, 'a+b')

  for pdf_info in pdf_info_list:
    submission_id = pdf_info['submission_id']
    single_submission_pdf = PyPDF2.PdfFileWriter()

    # TODO: Clean and don't allow split across different uploads
    for page_number, url in pdf_info['pages']:
      # If an submission is split across different uploads, the url would change
      if url != cur_url:
        # Erase the existing pdf file
        temp_pdf.truncate(0)
        # Load the new one from S3
        # TODO: this actually reads the file from S3 fully into RAM, and then
        # writes it to temp_pdf. streaming the file would be ideal, so as to
        # not require as much memory
        temp_pdf.write(urllib2.urlopen(url).read())
        entire_pdf = PyPDF2.PdfFileReader(temp_pdf)
        cur_url = url

      page = entire_pdf.pages[page_number - 1]
      single_submission_pdf.addPage(page)

    single_submission_file_name = '/tmp/%s.pdf' % utils.generate_random_string(20)
    single_submission_file = file(single_submission_file_name, 'a+b')
    single_submission_pdf.write(single_submission_file)

    # TODO: Race condition where someone edits the submission object (aka assigns a student)
    # to an submission while pdf.save() is running
    submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
    submission.pdf.save('exam-answer-pdf', files.File(single_submission_file))
    submission.save()

    os.remove(single_submission_file_name)
  os.remove(temp_pdf_name)
