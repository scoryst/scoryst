from celery import task as celery
from django import shortcuts, http
from django.core import files
from django.contrib import messages
from scorystapp import models, forms, decorators, utils, assessments_serializers
from scorystapp.views import helpers
from django.conf import settings
from django.utils import timezone
from datetime import datetime
import json, shlex, subprocess, tempfile, threading
import os
import PyPDF2
from rest_framework import serializers
from rest_framework import decorators as rest_decorators, response as rest_framework_response


@decorators.access_controlled
@decorators.instructor_or_ta_required
def assessments(request, cur_course_user):
  """
  Shows existing assessments and allows the user to edit/delete them.

  Also allows the user to upload a new assessment. On success, redirects to the
  create assessment page.
  """
  if request.method == 'POST':
    return _handle_assessment_form_submission(request, cur_course_user)
  return _render_assessments_page(request, cur_course_user)


def _render_assessments_page(request, cur_course_user):
  return helpers.render(request, 'assessments.epy', {
    'title': 'Assessments',
    'course': cur_course_user.course,
    'form': forms.AssessmentUploadForm(),
    'homework_assignments_exist': models.Homework.objects.filter(course=cur_course_user.course).count() > 0,
    'exams_exist': models.Exam.objects.filter(course=cur_course_user.course).count() > 0
  })


def _handle_assessment_form_submission(request, cur_course_user, assessment_id=None):
  """
  Handles request when user submits the form to create an assessment. The
  `assessment_id` is not None when the user is editing an assessment.
  """
  form = forms.AssessmentUploadForm(request.POST, request.FILES)

  if not form.is_valid():
    return _render_assessments_page(request, cur_course_user)

  data = form.cleaned_data
  assessment = None
  course = cur_course_user.course

  # Additional validation
  # For homework, ensure that the submission deadline is after the current date/time
  # For an exam that is being created, ensure that an exam PDF is uploaded. This
  # was removed from the Django form because it's not required for editing
  # Return an error status, which is not actually returned to the user
  if data['assessment_type'] == 'homework':
    submission_deadline = data['submission_deadline']
    if submission_deadline < timezone.localtime(timezone.now()):
      return http.HttpResponse(status=400)
  elif not assessment_id and not 'exam_file' in request.FILES:
    return http.HttpResponse(status=400)

  # Delete old `QuestionPart`s before new ones are created
  if assessment_id:
    qp = models.QuestionPart.objects.filter(assessment__pk=assessment_id)
    qp.delete()

  if data['assessment_type'] == 'exam':
    assessment = _handle_exam_form_submission(request, assessment_id, data, course)
  else:
    assessment = _handle_homework_form_submission(request, assessment_id, data, course)

  return shortcuts.redirect('/course/%d/assessments/create/%d' % (cur_course_user.course.pk, assessment.pk))


def _handle_exam_form_submission(request, assessment_id, data, course):
  exam = None
  grade_down = (data['grade_type'] == 'down')
  if assessment_id:  # exam is being edited
    exam = shortcuts.get_object_or_404(models.Exam, pk=assessment_id)
    exam.name = data['name'].strip()
    exam.grade_down = grade_down
    exam.save()

    # Delete old `ExamPage`s
    exam_pages = models.ExamPage.objects.filter(exam=exam)
    exam_pages.delete()
  else:  # assessment is exam and is being created
    # We set page_count = 0 here and update it after uploading images
    exam = models.Exam(course=course, name=data['name'], grade_down=grade_down, page_count=0)
    exam.save()  # need exam id for uploading, so we save immediately

  if 'exam_file' in request.FILES:
    page_count = _upload_exam_pdf_as_jpeg_to_s3(request.FILES['exam_file'], exam)
    _upload_pdf_to_s3(request.FILES['exam_file'], exam, exam.exam_pdf, 'exam-pdf')
    exam.page_count = page_count

  exam.save()

  if 'solutions_file' in request.FILES:
    _upload_pdf_to_s3(request.FILES['solutions_file'], exam, exam.solutions_pdf,
      'exam-solutions-pdf')

  # Create question parts for the exam
  question_part_info = json.loads(data['question_part_points'])
  for i, part_info in enumerate(question_part_info):
    for j, (points, pages) in enumerate(part_info):
      pages = pages.replace(' ', '')
      new_question_part = models.QuestionPart(assessment=exam,
        question_number=i+1, part_number=j+1, max_points=points, pages=pages)
      new_question_part.save()

  return exam


def _handle_homework_form_submission(request, assessment_id, data, course):
  grade_down = (data['grade_type'] == 'down')
  if assessment_id:
    homework = shortcuts.get_object_or_404(models.Homework, pk=assessment_id)
    homework.name = data['name']
    homework.grade_down = grade_down
    homework.submission_deadline = data['submission_deadline']
  else:
    homework = models.Homework(course=course, name=data['name'],
      grade_down=grade_down, submission_deadline=data['submission_deadline'])
  homework.save()

  if 'solutions_file' in request.FILES:
    _upload_pdf_to_s3(request.FILES['solutions_file'], homework, homework.solutions_pdf,
      'homework-solutions-pdf')

  # Create question parts for the assessment
  question_part_points = json.loads(data['question_part_points'])
  for i, part_points in enumerate(question_part_points):
    for j, points in enumerate(part_points):
      new_question_part = models.QuestionPart(assessment=homework,
        question_number=i+1, part_number=j+1, max_points=points)
      new_question_part.save()

  return homework


@decorators.access_controlled
@decorators.instructor_or_ta_required
def delete_assessment(request, cur_course_user, assessment_id):
  """ Allows the instructor/TA to delete a user from the course roster. """
  cur_course = cur_course_user.course

  # explicitly query the course to ensure user can access this assessment
  assessment = models.Assessment.objects.get(pk=assessment_id)
  submissions = models.Submission.objects.filter(assessment=assessment, preview=False)

  # Only allow editing if submissions don't exist
  if not submissions:
    assessment.delete()
  else:
    pass

  return shortcuts.redirect('/course/%d/assessments/' % cur_course.pk)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def create_assessment(request, cur_course_user, assessment_id, **kwargs):
  """
  Receives POST requests to edit a particular assessment. Also renders the page
  for a particular saved assessment.
  """
  assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)

  if request.method == 'POST':
    _handle_assessment_form_submission(request, cur_course_user, assessment_id)

  return helpers.render(request, 'assessments.epy', {
    'title': 'Assessments',
    'course': cur_course_user.course,
    'form': forms.AssessmentUploadForm(),
    'assessment_id': assessment_id,
    'assessment_name': assessment.name,
    'homework_assignments_exist': models.Homework.objects.filter(course=cur_course_user.course).count() > 0,
    'exams_exist': models.Exam.objects.filter(course=cur_course_user.course).count() > 0
  })


@celery.task
def upload(temp_pdf_name, num_pages, exam):
  temp_pdf = open(temp_pdf_name, 'r')

  # ImageMagick command is: 'convert pdf_file_name[page_number] img_name'
  for page_number in range(num_pages):
    temp_jpeg = tempfile.NamedTemporaryFile(suffix='.jpg')

    subprocess.call(shlex.split('convert -density 150 -size 1200x900 ' +
      temp_pdf.name + '[' + str(page_number) + '] '+ temp_jpeg.name))

    # Save it
    exam_page = models.ExamPage(exam=exam, page_number=page_number+1)
    exam_page.page_jpeg.save('exam-jpeg', files.File(temp_jpeg))
    exam_page.page_jpeg_large = exam_page.page_jpeg
    exam_page.save()

    # Close for automatic deletion
    temp_jpeg.close()

  # Delete the pdf file
  os.remove(temp_pdf_name)


# TODO: Use celery
def _upload_exam_pdf_as_jpeg_to_s3(f, exam):
  """
  Given a file f, which is expected to be an exam pdf, breaks it into jpegs for each
  page and uploads them to s3. Returns the number of pages in the pdf file.
  """
  temp_pdf_name = '/tmp/temp%s.pdf' % utils.generate_random_string(5)
  temp_pdf = open(temp_pdf_name, 'w')
  temp_pdf.seek(0)
  temp_pdf.write(f.read())
  temp_pdf.flush()

  pdf = PyPDF2.PdfFileReader(file(temp_pdf_name, 'rb'))
  upload.delay(temp_pdf_name, pdf.getNumPages(), exam)
  return pdf.getNumPages()


def _upload_pdf_to_s3(f, assessment, assessment_pdf_field, aws_folder_name):
  """ Uploads a pdf file representing an assessment or its solutions to s3 """
  assessment_pdf_field.save(aws_folder_name, files.File(f))
  assessment.save()


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def list_assessments(request, cur_course_user, assessment_id=None):
  """ Returns a list of `Assessment`s for the provided course. """
  assessments = models.Assessment.objects.filter(
    course=cur_course_user.course).order_by('id')
  serializer = assessments_serializers.AssessmentSerializer(assessments, many=True)
  return rest_framework_response.Response(serializer.data)


@rest_decorators.api_view(['GET'])
@decorators.access_controlled
def list_question_parts(request, cur_course_user, assessment_id):
  """ Returns a list of `QuestionPart`s for the provided course. """
  assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)
  question_parts = models.QuestionPart.objects.filter(assessment=assessment
    ).order_by('question_number', 'part_number')
  serializer = assessments_serializers.QuestionPartSerializer(question_parts, many=True)
  return rest_framework_response.Response(serializer.data)
