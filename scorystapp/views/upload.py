from celery import Celery
from django import shortcuts
from django.core import files
from django.conf import settings
from scorystapp import models, forms, decorators, utils
from scorystapp.views import helpers
import sys
import Image
import numpy
import os
import PyPDF2
import shlex
import subprocess

@decorators.login_required
@decorators.valid_course_user_required
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
      name_prefix = exam.name + utils._generate_random_string(5)
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


def _break_and_upload(exam, f, name_prefix):
  """
  Creates a temporary file in the /tmp/ folder and then passes it on to celery
  which asynchronously will break and upload it.
  """
  temp_pdf_name = '/tmp/%s.pdf' % name_prefix
  temp_pdf = open(temp_pdf_name, 'w')
  temp_pdf.seek(0)
  temp_pdf.write(f.read())
  temp_pdf.flush()

  _break_and_upload_celery.delay(exam, temp_pdf_name, name_prefix)


app = Celery('tasks', broker=settings.BROKER_URL)
@app.task
def _break_and_upload_celery(exam, temp_pdf_name, name_prefix):
  """
  Split the pdf into smaller pdfs- one for each exam, as well as jpegs and then
  calls create_unmapped_exam_answers 
  """
  temp_jpeg_name = '/tmp/%s%%d.jpg' % name_prefix
  
  # Split the pdf into jpegs
  subprocess.call(shlex.split('convert -density 150 -size 1200x900 %s %s' % 
    (temp_pdf_name, temp_jpeg_name)))

  entire_pdf = PyPDF2.PdfFileReader(file(temp_pdf_name, 'rb'))
  
  # Makes the assumption that all exams have the same number of pages
  num_pages = entire_pdf.getNumPages()
  # Makes the assumption that each page has questions on one side and nothing on the other
  num_pages_per_exam = exam.page_count * 2
  num_students = num_pages / num_pages_per_exam

  for cur_student in range(num_students):
    # For each student, create a new pdf
    single_student_pdf = PyPDF2.PdfFileWriter()

    for cur_page in range(num_pages_per_exam):
      page = entire_pdf.pages[cur_student * num_pages_per_exam + cur_page]
      single_student_pdf.addPage(page)
    
    single_student_pdf.write(open('/tmp/%s%d.pdf' % (name_prefix, cur_student), 'wb'))

  # Delete the giant pdf file
  os.remove(temp_pdf_name)  

  create_unmapped_exam_answers(exam, name_prefix, num_pages_per_exam, num_students)


def create_unmapped_exam_answers(exam, name_prefix, num_pages_per_exam, num_students):
  question_parts = models.QuestionPart.objects.filter(exam=exam)
  
  for cur_student in range(num_students):
    exam_answer = models.ExamAnswer(course_user=None, exam=exam, page_count=num_pages_per_exam)
    temp_pdf_name = '/tmp/%s%d.pdf' % (name_prefix, cur_student)

    temp_pdf = file(temp_pdf_name, 'rb')
    exam_answer.pdf.save('new', files.File(temp_pdf))
    exam_answer.save()
    os.remove(temp_pdf_name)

    for cur_page in range(num_pages_per_exam):
      exam_answer_page = models.ExamAnswerPage(exam_answer=exam_answer, page_number=cur_page+1)
      
      cur_page_num = cur_student * num_pages_per_exam + cur_page
      temp_jpeg_name = '/tmp/%s%d.jpg' % (name_prefix, cur_page_num)
      temp_jpeg = file(temp_jpeg_name, 'rb')
      exam_answer_page.page_jpeg.save('new', files.File(temp_jpeg))
      exam_answer_page.save()
      temp_jpeg.close()   

    for question_part in question_parts:
      answer_pages=''
      for page in question_part.pages.split(','):
        page = int(page)
        answer_pages = answer_pages +  str(2 * page - 1) + ','
      # Remove the trailing comma (,) from the end of answer_pages
      answer_pages = answer_pages[:-1]
      question_part_answer = models.QuestionPartAnswer(question_part=question_part,
        exam_answer=exam_answer, pages=answer_pages)
      question_part_answer.save()

    for cur_page in range(num_pages_per_exam):
      cur_page_num = cur_student * num_pages_per_exam + cur_page
      temp_jpeg_name = '/tmp/%s%d.jpg' % (name_prefix, cur_page_num)
      os.remove(temp_jpeg_name)
