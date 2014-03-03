from celery import task as celery
from django import shortcuts, http
from django.core import files
from django.contrib import messages
from scorystapp import models, forms, decorators, utils
from scorystapp.views import helpers
from django.conf import settings
import json, shlex, subprocess, tempfile, threading
import os
import PyPDF2


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def exams(request, cur_course_user):
  """
  Shows existing exams and allows the user to edit/delete them.

  Also allows the user to upload a new exam. On success, redirects to the
  create exam page.
  """
  cur_course = cur_course_user.course

  if request.method == 'POST':
    form = forms.ExamUploadForm(request.POST, request.FILES)

    if form.is_valid():
      # We set page_count = 0 here and update it after uploading images
      exam = models.Exam(course=cur_course, name=form.cleaned_data['exam_name'], page_count=0)
      exam.save()

      page_count = _upload_exam_pdf_as_jpeg_to_s3(request.FILES['exam_file'], exam)
      _upload_exam_pdf_to_s3(request.FILES['exam_file'], exam, exam.exam_pdf)
      
      exam.page_count = page_count
      exam.save()

      if 'exam_solutions_file' in request.FILES:
        _upload_exam_pdf_to_s3(request.FILES['exam_solutions_file'], exam, exam.solutions_pdf)
      
      return shortcuts.redirect('/course/%d/exams/create/%d' % (cur_course.pk, exam.pk))
  else:
    form = forms.ExamUploadForm()

  exams = models.Exam.objects.filter(course=cur_course).order_by('id')
  
  # Each element in the edit list is a (exam, can_edit) tuple where can_edit
  # is a boolean specifying whether the exam can be edited/deleted or not.
  exams_edit_list = []
  
  for exam in exams:
    exam_answers = models.ExamAnswer.objects.filter(exam=exam, preview=False)
    # Exam answers exist. Don't allow editing. 
    if exam_answers:
      exams_edit_list.append((exam, False))
    else:
      exams_edit_list.append((exam, True))

  return helpers.render(request, 'exams.epy', {
    'title': 'Exams',
    'course': cur_course,
    'form': form,
    'exams_edit_list': exams_edit_list
  })


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def delete_exam(request, cur_course_user, exam_id):
  """ Allows the instructor/TA to delete a user from the course roster. """
  cur_course = cur_course_user.course
  exam = models.Exam.objects.filter(pk=exam_id, course=cur_course)
  
  exam_answers = models.ExamAnswer.objects.filter(exam=exam, preview=False)
  # Only allow editing if exam answers don't exist
  if not exam_answers:
    exam.delete()

  return shortcuts.redirect('/course/%d/exams/' % cur_course.pk)


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def create_exam(request, cur_course_user, exam_id):
  """
  Step 2 of creating an exam. We have an object in the Exam models and now are 
  adding the questions and rubrics.
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  exam_answers = models.ExamAnswer.objects.filter(exam=exam, preview=False)
  # Only allow editing if exam answers don't exist
  if exam_answers:
    return shortcuts.redirect('/course/%d/exams/' % cur_course_user.course.pk)

  if request.method == 'POST':
    exam_object = json.loads(request.POST['exam-json'])
    questions = exam_object['questions']
    grade_down = bool(exam_object['gradeDown'])
    # Validate the new rubrics and store the new forms in form_list
    success, form_list = _validate_exam_creation(questions)

    if not success:
      for error in form_list:
        messages.add_message(request, messages.ERROR, error)
    else:
      # If we are editing an existing exam, delete the previous one
      models.QuestionPart.objects.filter(exam=exam).delete()

      # Update grading up or down
      exam.grade_down = grade_down
      exam.save()

      # Makes the assumption that the form is in order, i.e.
      # We first have question_part 1, then the rubrics associated with that,
      # then the next one, and so on and so forth.
      for form_type, form in form_list:
        # Get the form, but don't commit it yet
        partial_form = form.save(commit=False)
        
        if form_type == 'question_part':
          # If it's a question_part, add in the exam and save it
          partial_form.exam = exam
          partial_form.save()
          question_part = models.QuestionPart.objects.get(pk=partial_form.id)
        else:
          # Otherwise, it's a rubric and the previous form would have been
          # a question_part, so add in the question_part and save
          partial_form.question_part = question_part
          partial_form.save()

      # Now, we create a preview exam answer
      exam_answer = _create_preview_exam_answer(cur_course_user, exam)
      return http.HttpResponseRedirect('/course/%d/exams/preview/%s/' %
        (cur_course_user.course.id, exam_answer.pk))

  return helpers.render(request, 'create-exam.epy', {'title': 'Create'})


def _create_preview_exam_answer(cur_course_user, exam):
  """
  Creates a fake exam_answer that the instructor can preview while creating the
  exam. 
  """
  # Delete all previous preview exams
  exam_answers = models.ExamAnswer.objects.filter(exam=exam,
    course_user=cur_course_user, preview=True)
  exam_answers.delete()

  exam_answer = models.ExamAnswer(exam=exam, course_user=cur_course_user,
    page_count=exam.page_count, preview=True, pdf=exam.exam_pdf)
  exam_answer.save()

  question_parts = models.QuestionPart.objects.filter(exam=exam)
  for question_part in question_parts:
    question_part_answer = models.QuestionPartAnswer(exam_answer=exam_answer,
      question_part=question_part, pages=question_part.pages)
    question_part_answer.save()
  # TODO: Race condition where uploading images hasn't finished. FML

  exam_pages = models.ExamPage.objects.filter(exam=exam)
  for exam_page in exam_pages:
    exam_answer_page = models.ExamAnswerPage(exam_answer=exam_answer,
      page_number=exam_page.page_number, page_jpeg=exam_page.page_jpeg)
    exam_answer_page.save()

  return exam_answer


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def get_empty_exam_jpeg(request, cur_course_user, exam_id, page_number):
  """ Returns the URL where the jpeg of the empty uploaded exam can be found """
  exam_page = shortcuts.get_object_or_404(models.ExamPage, exam_id=exam_id, page_number=page_number)
  return shortcuts.redirect(exam_page.page_jpeg.url)


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def get_empty_exam_page_count(request, cur_course_user, exam_id):
  """ Returns the number of pages in the exam """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  return http.HttpResponse(exam.page_count)


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def get_saved_exam(request, cur_course_user, exam_id):
  """
  Needed to edit exam rubrics. Returns a JSON to the create-exam.js ajax call
  that will then call recreate-exam.js to recreate the UI
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  
  questions_list = []

  # Get the question_parts associated with the exam
  question_parts = models.QuestionPart.objects.filter(exam_id=exam.id).order_by(
    'question_number', 'part_number')
  question_number = 0
  
  for question_part in question_parts:
    # Increment question_number only when it changes
    # If it hasn't changed, it means we are on a new part of the same question
    if question_number != question_part.question_number:
      question_number += 1
      questions_list.append([])

    part = {
      'points': question_part.max_points,
      'pages': question_part.pages.split(','),
      'rubrics': []
    }

    rubrics = models.Rubric.objects.filter(question_part=question_part)
    for rubric in rubrics:
      part['rubrics'].append({
        'description': rubric.description,
        'points': rubric.points
      })

    questions_list[question_number - 1].append(part)

  return_object = {
    'questions': questions_list,
    'gradeDown': exam.grade_down
  }
  return http.HttpResponse(json.dumps(return_object), mimetype='application/json')

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
    exam_page.page_jpeg.save('new', files.File(temp_jpeg))
    exam_page.save()

    # Close for automatic deletion
    temp_jpeg.close()

  # Delete the pdf file
  os.remove(temp_pdf_name)

def _upload_exam_pdf_as_jpeg_to_s3(f, exam):
  """
  Given a file f, which is expected to be an exam pdf, breaks it into jpegs for each
  page and uploads them to s3. Returns the number of pages in the pdf file
  """
  temp_pdf_name = '/tmp/temp%s.pdf' % utils._generate_random_string(5)
  temp_pdf = open(temp_pdf_name, 'w')
  temp_pdf.seek(0)
  temp_pdf.write(f.read())
  temp_pdf.flush()

  pdf = PyPDF2.PdfFileReader(file(temp_pdf_name, 'rb'))
  upload.delay(temp_pdf_name, pdf.getNumPages(), exam)
  return pdf.getNumPages()

# TODO: Use celery
def _upload_exam_pdf_to_s3(f, exam, exam_pdf_field):
  """ Uploads a pdf file representing an exam or its solutions to s3 """
  def upload(f, exam):
    exam_pdf_field.save('new', files.File(f))
    exam.save()
  t = threading.Thread(target=upload, args=(f, exam)).start()


def _validate_exam_creation(questions):
  """
  Validates the given exam, creating a form object for each question and rubric.
  
  Returns (boolean, a list of tuples), where boolean is true if validation was
  successful and false otherwise. Each tuple is of the form (type, form).
  
  type is either question or rubric, depending on whether form corresponds to a
  QuestionForm or RubricForm. 
  form is the form object itself. Note that we don't save the forms because we
  want the entire exam creation to be batched; either we create the exam in its
  entirety, or we don't create it all.
  """
  form_list = []
  question_number = 0

  # Loop over all the questions
  for question in questions:
    # TOOD: Better way to not have null question?
    if not question:
      continue
    question_number += 1
    part_number = 0

    # Loop over all the parts
    for part in question:
      part_number += 1
      # Create the form needed for QuestionForm validation
      question_part_form = {
        'question_number': question_number,
        'part_number': part_number,
        'max_points': part['points'],
        'pages': ','.join(map(str, part['pages']))
      }

      form = forms.QuestionPartForm(question_part_form)
      if form.is_valid():
        form_list.append(('question_part', form))
      else:
        return False, form.errors.values()

      # Loop over the rubrics
      for rubric in part['rubrics']:
        rubric_form = {
          'description': rubric['description'],
          'points': rubric['points']
        }

        form = forms.RubricForm(rubric_form)
        if form.is_valid():
          form_list.append(('rubric', form))
        else:
          return False, form.errors.values()

  return True, form_list
