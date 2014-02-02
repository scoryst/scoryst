from django import shortcuts, http
from scorystapp import models, forms, decorators
from scorystapp.views import helpers, grade_or_view, send_email, statistics
import csv
import json


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def grade_overview(request, cur_course_user):
  """ Overview of all of the students' exams and grades for a particular exam. """
  cur_course = cur_course_user.course
  exams = models.Exam.objects.filter(course=cur_course.pk).order_by('id')

  return helpers.render(request, 'grade-overview.epy', {
    'title': 'Exams',
    'exams': exams,
    'is_student': False
  })


@decorators.login_required
@decorators.valid_course_user_required
def student_grade_overview(request, cur_course_user):
  """ Overview of the logged in student's exams and grades for a particular exam. """
  cur_course = cur_course_user.course
  
  exams = models.Exam.objects.filter(course=cur_course.pk)
  return helpers.render(request, 'grade-overview.epy', {
    'title': 'Exams',
    'exams': exams,
    'course_user': cur_course_user,
    'is_student': True
  })  


@decorators.login_required
@decorators.valid_course_user_required
def get_user_exam_summary(request, cur_course_user, user_id, exam_id):
  """ Returns an exam summary given the user's ID and the course. """
  try:
    exam_answer = models.ExamAnswer.objects.get(exam=exam_id, course_user__user=user_id)
  except models.ExamAnswer.DoesNotExist:
    return http.HttpResponse(json.dumps({'noMappedExam': True}),
      mimetype='application/json')

  exam_summary = _get_summary_for_exam(exam_answer.id)
  return http.HttpResponse(json.dumps(exam_summary), mimetype='application/json')


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_required
def release_grades(request, cur_course_user, exam_id):
  # TODO: Add released to model, so that instructor knows grades are released
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  send_email.send_exam_graded_email(request, exam)
  return shortcuts.redirect('/course/%d/grade/' % cur_course_user.course.pk)


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def get_csv(request, cur_course_user, exam_id):
  """
  Returns a csv of the form (last_name, first_name, email, score_in_exam)
  for each student who took the exam
  """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)

  # Create the HttpResponse object with the appropriate CSV header.
  response = http.HttpResponse(content_type='text/csv')
  
  filename = "%s-scores.csv" % exam.name
  # Replace spaces in the exam name with dashes and convert to lower case
  filename = filename.replace(' ', '-').lower()

  response['Content-Disposition'] = 'attachment; filename="%s"' % filename
  
  writer = csv.DictWriter(response, fieldnames=['Last Name', 'First Name', 'ID', 'Email', 'Score'])

  exam_answers = models.ExamAnswer.objects.filter(exam=exam
    ).order_by('course_user__user__last_name')

  writer.writeheader()
  
  for exam_answer in exam_answers:
    user = exam_answer.course_user.user
    is_entire_exam_graded = exam_answer.is_graded()
    score = exam_answer.get_points()

    if not is_entire_exam_graded:
      score = 'ungraded'

    writer.writerow({
      'Last Name': user.last_name, 
      'First Name': user.first_name, 
      'ID': user.student_id, 
      'Email': user.email, 
      'Score': score
    })

  return response


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def get_students(request, cur_course_user, exam_id):
  """
  Returns JSON information about the list of students associated with the
  exam id.
  """
  cur_course = cur_course_user.course

  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  max_score = exam.get_points()
  student_course_users = models.CourseUser.objects.filter(course=cur_course.pk,
    privilege=models.CourseUser.STUDENT).order_by('user__first_name')

  student_users_to_return = []
  for i, student_course_user in enumerate(student_course_users):
    try:
      exam_answer = models.ExamAnswer.objects.get(course_user=student_course_user,
        exam=exam)
      filter_type = 'graded' if exam_answer.is_graded() else 'ungraded'
      is_graded = exam_answer.is_graded()
      score = exam_answer.get_points() if filter_type is 'graded' else filter_type
    except:
      is_graded = False
      filter_type = 'unmapped'
      score = 'no exam'
    student = {
      'first': bool(i == 0),
      'fullName': student_course_user.user.get_full_name(),
      'email': student_course_user.user.email,
      'student_id': student_course_user.user.student_id,
      'pk': student_course_user.user.pk,
      'filterType': filter_type,
      'score': score,
      'isGraded': is_graded,
      'maxScore': max_score
    }
    student_users_to_return.append(student)

  to_return = {'studentUsers': student_users_to_return}

  return http.HttpResponse(json.dumps(to_return), mimetype='application/json')


@decorators.login_required
@decorators.valid_course_user_required
@decorators.instructor_or_ta_required
def get_overview(request, cur_course_user, exam_id):
  """ Returns information about the exam, not specific to any student. """
  exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
  exam_answers = models.ExamAnswer.objects.filter(exam=exam, course_user__isnull=False,
    preview=False)

  num_graded = 0
  num_ungraded = 0

  for exam_answer in exam_answers:
    ungraded_question_answers = models.QuestionPartAnswer.objects.filter(
      exam_answer=exam_answer)
    num_ungraded_question_answers = len([x for x in ungraded_question_answers if not x.is_graded()])
    if num_ungraded_question_answers > 0:
      num_ungraded += 1
    else:
      num_graded += 1

  cur_course = cur_course_user.course
  num_student_users = models.CourseUser.objects.filter(course=cur_course.pk,
    privilege=models.CourseUser.STUDENT).count()
  num_unmapped = num_student_users - num_graded - num_ungraded

  to_return = {
    'numGraded': num_graded,
    'numUngraded': num_ungraded,
    'numUnmapped': num_unmapped,
    'mapped': bool(num_graded + num_ungraded > 0)
  }

  return http.HttpResponse(json.dumps(to_return), mimetype='application/json')


def _get_summary_for_exam(exam_answer_id, question_number=0, part_number=0):
  """
  Returns the questions and question answers as a dict.

  The resulting questions have the following fields: points, maxPoints, graded
  (bool), and a list of objects representing a particular question part. Each
  of these question part objects have the following fields: questionNum,
  partNum, active (bool), partPoints, and maxPoints. 

  The question_number and part_number are 0 by default, signifying that none of
  the question parts found should be marked as "active".
  """

  # Get the corresponding exam answer
  exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)

  # Get the questions and question answers. Will be used for the exam
  # navigation.
  question_parts = models.QuestionPart.objects.filter(exam=exam_answer.exam).order_by(
    'question_number', 'part_number')

  exam_to_return = {
      'points': 0,
      'maxPoints': 0,
      'isGraded': True,
      'questions': [],
      'examAnswerId': exam_answer_id
  }

  cur_question = 0

  for question_part in question_parts:
    if question_part.question_number != cur_question:
      new_question = {
        'questionNumber': question_part.question_number,
        'maxPoints': 0,
        'questionPoints': 0,
        'isGraded': True,
        'parts': []
      }
      exam_to_return['questions'].append(new_question)
      cur_question += 1

      question_part_answers = models.QuestionPartAnswer.objects.filter(
        question_part__question_number=question_part.question_number,
        exam_answer=exam_answer)
      graded_answers = filter(lambda answer: answer.is_graded(), question_part_answers)
      graders = map(lambda answer: answer.grader.user.get_initials(), graded_answers)
      if len(set(graders)) > 1:
        new_question['grader'] = ', '.join(set(graders))
      elif len(set(graders)) == 1:
        new_question['grader'] = graded_answers[0].grader.user.get_full_name()

    cur_last_question = exam_to_return['questions'][-1]    
    cur_last_question['parts'].append({})
    part = cur_last_question['parts'][-1]
    part['partNumber'] = question_part.part_number

    # Set active field
    part['active'] = False
    if (question_part.question_number == int(question_number) and
        question_part.part_number == int(part_number)):
      part['active'] = True

    part['maxPartPoints'] = question_part.max_points
    exam_to_return['maxPoints'] += question_part.max_points
    cur_last_question['maxPoints'] += question_part.max_points

    question_part_answer = shortcuts.get_object_or_404(models.QuestionPartAnswer,
      question_part=question_part, exam_answer=exam_answer)

    # Set the part points. We are assuming that we are grading up.
    part['partPoints'] = question_part_answer.get_points()
    cur_last_question['questionPoints'] += question_part_answer.get_points()
    part['isGraded'] = question_part_answer.is_graded()

    # Set the grader.
    if question_part_answer.grader is not None:
      part['grader'] = question_part_answer.grader.user.get_full_name()

    # Update the overall exam
    if not part['isGraded']:
      # If a part is ungraded, the exam is ungraded
      exam_to_return['isGraded'] = False
      # Similarly, the question associated with the part is ungraded
      cur_last_question['isGraded'] = False
    else:  # If a part is graded, update the overall exam points
      exam_to_return['points'] += part['partPoints']

  return exam_to_return
