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
import pytz
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
  timezone_string = cur_course_user.course.get_timezone_string()
  current_time = timezone.localtime(timezone.now(), timezone=pytz.timezone(timezone_string))

  return helpers.render(request, 'assessments.epy', {
    'title': 'Assessments',
    'course': cur_course_user.course,
    'form': forms.AssessmentUploadForm(),
    'homework_assignments_exist': models.Homework.objects.filter(course=cur_course_user.course).count() > 0,
    'exams_exist': models.Exam.objects.filter(course=cur_course_user.course).count() > 0,
    'current_time': current_time.strftime('%m/%d/%Y %I:%M %p'),
    'timezone_string': timezone_string
  })


def _handle_assessment_form_submission(request, cur_course_user, assessment_id=None):
  """
  Handles request when user submits the form to create an assessment. The
  `assessment_id` is not None when the user is editing an assessment.
  """
  form = forms.AssessmentUploadForm(request.POST, request.FILES,
    timezone_string=cur_course_user.course.get_timezone_string())

  if not form.is_valid():
    return _render_assessments_page(request, cur_course_user)

  data = form.cleaned_data
  assessment = None
  course = cur_course_user.course

  is_fully_editable = (models.Submission.objects.filter(assessment__pk=assessment_id).count() == 0)

  # Validate that `grade_type` is there if needed
  if is_fully_editable and not data.get('grade_type'):
    return http.HttpResponse(status=400)

  if is_fully_editable:
    # Additional validation
    # For homework, ensure that the soft/hard deadline is after the current date/time
    # For an exam that is being created, ensure that an exam PDF is uploaded. This
    # was removed from the Django form because it's not required for editing
    # Return an error status, which is not actually returned to the user
    current_time = timezone.now()
    if data['assessment_type'] == 'homework':
      soft_deadline = data['soft_deadline']
      if soft_deadline < current_time:
        return http.HttpResponse(status=400)

      hard_deadline = data['hard_deadline']
      if hard_deadline < current_time or hard_deadline < soft_deadline:
        return http.HttpResponse(status=400)

    elif not assessment_id and not 'exam_file' in request.FILES:
      return http.HttpResponse(status=400)

    # Delete old `QuestionPart`s before new ones are created
    if assessment_id:
      qp = models.QuestionPart.objects.filter(assessment__pk=assessment_id)
      qp.delete()

    if data['assessment_type'] == 'exam':
      _handle_full_exam_edit(request, data, course, assessment_id)
    else:
      _handle_full_homework_edit(request, data, course, assessment_id)

    return shortcuts.redirect('/course/%d/assessments/' % cur_course_user.course.pk)

  else:  # Can only partially edit the assessment
    question_part_info = json.loads(data['question_part_points'])
    assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)

    # Validate that the number of questions have not been changed
    num_questions = len(question_part_info)
    if assessment.get_num_questions() != num_questions:
      return http.HttpResponse(status=400)

    # Validate that the number of parts for each question have not been changed
    question_parts = models.QuestionPart.objects.filter(assessment=assessment)
    for i, part_info in enumerate(question_part_info):
      question_num = i + 1
      if question_parts.filter(question_number=question_num).count() != len(part_info):
        return http.HttpResponse(status=400)

    # The necessary validation was done, so now make changes to the assessment
    if data['assessment_type'] == 'exam':
      _handle_partial_exam_edit(request, assessment_id, data, course, True)
    else:
      _handle_partial_homework_edit(request, assessment_id, data, course, True)
    return shortcuts.redirect('/course/%d/assessments/' % cur_course_user.course.pk)


def _handle_partial_exam_edit(request, exam_id, data, course, should_update_qp):
  """
  Sets the name, exam file, and solutions file. Assumes that an exam with the
  given `exam_id` exists. If `should_update_qp` is True, updates the points and
  pages for each `QuestionPart` as well.
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  exam.name = data['name'].strip()

  if 'exam_file' in request.FILES:
    # Delete old `ExamPage`s
    exam_pages = models.ExamPage.objects.filter(exam=exam)
    exam_pages.delete()

    # Upload new exam file
    page_count = _upload_exam_pdf_as_jpeg_to_s3(request.FILES['exam_file'], exam)
    _upload_pdf_to_s3(request.FILES['exam_file'], exam, exam.exam_pdf, 'exam-pdf')
    exam.page_count = page_count

  if 'solutions_file' in request.FILES:
    _upload_pdf_to_s3(request.FILES['solutions_file'], exam, exam.solutions_pdf,
      'exam-solutions-pdf')

  if should_update_qp:  # Change the points/pages
    question_part_info = json.loads(data['question_part_points'])
    question_parts = models.QuestionPart.objects.filter(assessment=exam)
    for i, part_info in enumerate(question_part_info):
      for j, (points, pages) in enumerate(part_info):
        question_part = shortcuts.get_object_or_404(question_parts,
          question_number=i+1, part_number=j+1)

        question_part.max_points = points
        question_part.pages = pages.replace(' ', '')
        question_part.save()

  exam.save()
  return exam


def _handle_partial_homework_edit(request, homework_id, data, course, should_update_qp):
  """
  Sets the name, submission deadline, and solutions file. Assumes that a homework
  with the given `homework_id` exists. If `should_update_qp` is True, updates the
  points for each `QuestionPart` as well.
  """
  homework = shortcuts.get_object_or_404(models.Homework, pk=homework_id)

  homework.name = data['name']
  homework.soft_deadline = data['soft_deadline']
  homework.hard_deadline = data['hard_deadline']

  if homework.soft_deadline > homework.hard_deadline:
    raise http.Http404

  if 'solutions_file' in request.FILES:
    _upload_pdf_to_s3(request.FILES['solutions_file'], homework, homework.solutions_pdf,
      'homework-solutions-pdf')

  if should_update_qp:  # Change the points
    question_part_info = json.loads(data['question_part_points'])
    question_parts = models.QuestionPart.objects.filter(assessment=homework)
    for i, part_info in enumerate(question_part_info):
      for j, points in enumerate(part_info):
        question_part = shortcuts.get_object_or_404(question_parts,
          question_number=i+1, part_number=j+1)

        if question_part.max_points != points:
          question_part.max_points = points
          question_part.save()

  homework.save()
  return homework


def _handle_full_exam_edit(request, data, course, exam_id=None):
  """
  All of the fields for an exam are set using the form `data`. If there is no
  given `exam_id`, first creates the exam.
  """
  grade_down = (data['grade_type'] == 'down')

  if exam_id:  # exam is being edited
    qp = models.QuestionPart.objects.filter(assessment__pk=exam_id)
    qp.delete()

    exam.grade_down = grade_down
  else:  # assessment is exam and is being created
    # We set page_count = 0 here and update it after uploading images
    exam = models.Exam(course=course, name=data['name'], grade_down=grade_down, page_count=0)

  exam.save()

  # Create question parts (with correct answer rubrics) for the exam
  question_part_info = json.loads(data['question_part_points'])
  for i, part_info in enumerate(question_part_info):
    for j, (points, pages) in enumerate(part_info):
      pages = pages.replace(' ', '')
      new_question_part = models.QuestionPart(assessment=exam,
        question_number=i+1, part_number=j+1, max_points=points, pages=pages)
      new_question_part.save()

      correct_answer_rubric_points = 0 if exam.grade_down else points
      new_rubric = models.Rubric(question_part=new_question_part, description="Correct answer",
        points=correct_answer_rubric_points)
      new_rubric.save()

  _handle_partial_exam_edit(request, exam.id, data, course, False)


def _handle_full_homework_edit(request, data, course, homework_id=None):
  """
  All of the fields for an exam are set using the form `data`. If there is no
  given `homework_id`, first creates the homework.
  """
  grade_down = (data['grade_type'] == 'down')

  if homework_id:
    qp = models.QuestionPart.objects.filter(assessment__pk=homework_id)
    qp.delete()

    homework = shortcuts.get_object_or_404(models.Homework, pk=homework_id)
    homework.grade_down = grade_down
  else:
    homework = models.Homework(course=course, name=data['name'],
      grade_down=grade_down, soft_deadline=data['soft_deadline'],
      hard_deadline=data['hard_deadline'])

  homework.save()

  # Create question parts for the assessment
  question_part_points = json.loads(data['question_part_points'])
  for i, part_points in enumerate(question_part_points):
    for j, points in enumerate(part_points):
      new_question_part = models.QuestionPart(assessment=homework,
        question_number=i+1, part_number=j+1, max_points=points)
      new_question_part.save()

      correct_answer_rubric_points = 0 if homework.grade_down else points
      new_rubric = models.Rubric(question_part=new_question_part, description="Correct answer",
        points=correct_answer_rubric_points)
      new_rubric.save()

  _handle_partial_homework_edit(request, homework.id, data, course, False)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def delete_assessment(request, cur_course_user, assessment_id):
  """ Allows the instructor/TA to delete an assessment. """
  cur_course = cur_course_user.course

  # explicitly query the course to ensure user can access this assessment
  assessment = models.Assessment.objects.get(pk=assessment_id)
  submissions = models.Submission.objects.filter(assessment=assessment, preview=False)

  # Only allow editing if submissions don't exist
  if submissions.count() == 0:
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
