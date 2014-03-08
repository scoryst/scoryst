from django import shortcuts, http
from scorystapp import models, decorators
from scorystapp.views import helpers, grade, grade_or_view
import json


@decorators.access_controlled
@decorators.instructor_or_ta_required
def map(request, cur_course_user, exam_id, exam_answer_id=None):
  """ Renders the map exams page """

  # If no exam_answer_id is given, show the first exam_answer
  if exam_answer_id is None:
    exam_answers = models.ExamAnswer.objects.filter(exam_id=exam_id, preview=False)
    # TODO: How should I handle it best if length is 0?
    if not exam_answers.count() == 0:
      exam_answer_id = exam_answers[0].id
      return shortcuts.redirect('/course/%s/exams/%s/map/%s/' %
        (cur_course_user.course.id, exam_id, exam_answer_id))

  return helpers.render(request, 'map-exams.epy', {'title': 'Map Exams'})


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_all_course_students(request, cur_course_user, exam_id):
  """
  Returns a json representation of a list where each element has the name, email,
  student_id, course_user id of the student along with 'tokens' which is needed by typeahead.js
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  students = models.CourseUser.objects.filter(course=cur_course_user.course,
    privilege=models.CourseUser.STUDENT)

  students_to_return = []
  for student in students:
    student_to_return = {
      'name': student.user.get_full_name(),
      'email': student.user.email,
      'studentId': student.user.student_id,
      'courseUserId': student.id,
      'tokens': [student.user.first_name, student.user.last_name]
    }

    # Check if the student has already been mapped or not
    try:
      exam_answer = models.ExamAnswer.objects.get(course_user=student,exam=exam)
      student_to_return['mapped'] = True
    except:
      student_to_return['mapped'] = False

    students_to_return.append(student_to_return)

  return http.HttpResponse(json.dumps(students_to_return), mimetype='application/json')


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_all_exams(request, cur_course_user, exam_id, exam_answer_id):
  """
  Returns a list where each element is a dict of exam_answer_id, url to the jpeg image of the
  first page of the exam and whether or not the exam is already mapped to a student
  """
  exam_answers = models.ExamAnswer.objects.filter(exam_id=exam_id, preview=False)
  exam_answers_list = []

  index = 0
  for exam_answer in exam_answers:
    if exam_answer.pk == int(exam_answer_id):
      current_index = index
    index += 1

    exam_answers_list.append({
      'examAnswerId': exam_answer.id,
      'mappedTo': exam_answer.course_user.user.get_full_name() if exam_answer.course_user else None
    })

  return_object = {
    'currentIndex': current_index,
    'exams': exam_answers_list
  }

  return http.HttpResponse(json.dumps(return_object), mimetype='application/json')


@decorators.access_controlled
@decorators.instructor_or_ta_required
def map_exam_to_student(request, cur_course_user, exam_id, exam_answer_id, course_user_id):
  """
  Maps the exam_answer corresponding to exam_answer_id to the course user corresponding to
  course_user_id
  """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  course_user = shortcuts.get_object_or_404(models.CourseUser, pk=course_user_id)
  if not exam_answer.exam.course == course_user.course:
    raise Exception('This should have never happened')
  exam_answer.course_user = course_user
  exam_answer.save()
  return http.HttpResponse(status=200)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_exam_jpeg(request, cur_course_user, exam_id, exam_answer_id, page_number):
  """ Gets the jpeg corresponding to exam_answer_id and page_number """
  return grade_or_view._get_exam_jpeg(request, cur_course_user, exam_answer_id, page_number)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_exam_jpeg_large(request, cur_course_user, exam_id, exam_answer_id, page_number):
  """ Gets the large jpeg corresponding to exam_answer_id and page_number """
  return grade_or_view._get_exam_jpeg_large(request, cur_course_user, exam_answer_id, page_number)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_offset_student_jpeg(request, cur_course_user, exam_id, exam_answer_id, offset, page_number):
  """
  Gets the jpeg corresponding to page_number for the answer present at offset from the current exam
  answer. If we reach either bounds (0 or last exam), we return the bound
  """
  # Ensure the exam_answer_id exists
  cur_exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  next_exam_answer = grade._get_offset_student_exam(exam_answer_id, offset)
  return grade_or_view._get_exam_jpeg(request, cur_course_user, next_exam_answer.pk, page_number)


@decorators.access_controlled
@decorators.instructor_or_ta_required
def get_exam_page_count(request, cur_course_user, exam_id, exam_answer_id):
  """
  Returns the number of pages in the exam
  """
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
  return http.HttpResponse(exam_answer.page_count)
