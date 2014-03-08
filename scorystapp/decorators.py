from scorystapp import models
from django import shortcuts
from django import http


def login_required(fn):
  """ Returns the function below: """
  def validate_logged_in(request, *args, **kwargs):
    """
    Validates that the user is logged in. If so, calls fn. Otherwise, redirects
    to login page.
    """
    if not request.user.is_authenticated():
      return shortcuts.redirect('/login/redirect%s' % request.path)
    return fn(request, *args, **kwargs)

  return validate_logged_in


def valid_course_user_required(fn):
  """ Returns the function below: """
  def validate_course(request, course_id, *args, **kwargs):
    """
    Validates that the given course ID is valid. If so, calls fn. Otherwise,
    renders a 404 page.
    """
    course_user = shortcuts.get_object_or_404(models.CourseUser,
      user=request.user.pk, course=course_id)
    return fn(request, course_user, *args, **kwargs)

  return validate_course


def consistent_course_user_exam_required(fn):
  """ Returns the function below: """
  def validate_course_user_exam_consistency(request, course_user, *args, **kwargs):
    """
    Validates that the given course user and the given exam_id (if any) and exam_answer_id (if any)
    are consistent with each other so that if an exam belongs to course with id: 123, 
    then a course_user with course_id 234 can't access it.

    Should be chained with @valid_course_user_required (defined above), like so:

      @valid_course_user_required
      @course_user_exam_consistent
      def view_fn():
        ...
    """
    if 'exam_id' in kwargs:
      exam_id = kwargs['exam_id']
      exam = shortcuts.get_object_or_404(models.Exam, pk=exam_id)
      if course_user.course != exam.course:
        raise http.Http404('Course user not consistent with the exam trying to be accessed.')

    if 'exam_answer_id' in kwargs:
      exam_answer_id = kwargs['exam_answer_id']
      exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
      if course_user.course != exam_answer.exam.course:
        raise http.Http404('Course user not consistent with the exam answer trying to be accessed.')

    if 'exam_id' in kwargs and 'exam_answer_id' in kwargs:
      # Note: If the stamement above evalues to true, we already have exam_answer and exam as
      # variables from the conditions above.
      if exam_answer.exam != exam:
        raise http.Http404('Exam not consistent with the exam answer trying to be accessed.')

    return fn(request, course_user, *args, **kwargs)

  return validate_course_user_exam_consistency


def access_controlled(fn):
  """
  Calls: 
  1. login_required
  2. valid_course_user_required
  3. consistent_course_user_exam_required

  It DOES NOT check for instructor_required or instructor_or_ta_required etc.
  """
  return login_required(valid_course_user_required(consistent_course_user_exam_required(fn)))


def student_required(fn):
  """ Returns the function below: """
  def validate_student(request, course_user, exam_answer_id, *args, **kwargs):
    """
    Validates that the current course user matches the user that the exam answer
    belongs to, or that the current course user is an instructor/TA.

    Should be chained with @valid_course_user_required (defined above), like so:

      @valid_course_user_required
      @student_required
      def view_fn():
        ...
    """
    if (course_user.privilege != models.CourseUser.INSTRUCTOR and
        course_user.privilege != models.CourseUser.TA):
      exam_answer = shortcuts.get_object_or_404(models.ExamAnswer, pk=exam_answer_id)
      if exam_answer.course_user != course_user:
        raise http.Http404('This exam doesn\'t seem to belong to you.')
    return fn(request, course_user, exam_answer_id, *args, **kwargs)

  return validate_student


def instructor_required(fn):
  """ Returns the function below: """
  def validate_instructor(request, course_user, *args, **kwargs):
    """
    Validates that the given course user is an instructor. If so, calls fn.
    Otherwise, renders a 404 page.

    Should be chained with @valid_course_user_required (defined above), like so:

      @valid_course_user_required
      @instructor_required
      def view_fn():
        ...
    """
    if not course_user.privilege == models.CourseUser.INSTRUCTOR:
      raise http.Http404('Must be an instructor.')
    return fn(request, course_user, *args, **kwargs)

  return validate_instructor


def instructor_or_ta_required(fn):
  def validate_instructor_or_ta(request, course_user, *args, **kwargs):
    """
    Validates that the given course user is an instructor or TA. If so, calls fn.
    Otherwise, renders a 404 page.

    Should be chained with @valid_course_user_required (defined above), like so:

      @valid_course_user_required
      @instructor_or_ta_required
      def view_fn():
        ...
    """
    if (course_user.privilege != models.CourseUser.INSTRUCTOR and
        course_user.privilege != models.CourseUser.TA):
      raise http.Http404('Must be an instructor or a TA.')
    return fn(request, course_user, *args, **kwargs)

  return validate_instructor_or_ta


def instructor_for_any_course_required(fn):
    """ Returns the function below: """
    def validate_instructor_for_any_course(request, *args, **kwargs):
      """
      Validates that the given course user is an instructor for at least one
      other course. If so, calls fn.
      Otherwise, renders a 404 page.
      """
      if not request.user.is_instructor_for_any_course():
        raise http.Http404('Only valid instructors can create a new course.')
      return fn(request, *args, **kwargs)

    return validate_instructor_for_any_course
