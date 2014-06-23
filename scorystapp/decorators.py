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


def consistent_course_user_assessment_required(fn):
  """ Returns the function below: """
  def validate_course_user_assessment_consistency(request, course_user, *args, **kwargs):
    """
    Validates that the given course user and the given assessment_id (if any) and submission_id (if any)
    are consistent with each other so that if an assessment belongs to course with id: 123,
    then a course_user with course_id 234 can't access it.

    Should be chained with @valid_course_user_required (defined above), like so:

      @valid_course_user_required
      @consistent_course_user_assessment_required
      def view_fn():
        ...
    """
    if 'assessment_id' in kwargs:
      assessment_id = kwargs['assessment_id']
      assessment = shortcuts.get_object_or_404(models.Assessment, pk=assessment_id)
      if course_user.course != assessment.course:
        raise http.Http404('Course user not consistent with the assessment trying to be accessed.')

    if 'submission_id' in kwargs:
      submission_id = kwargs['submission_id']
      submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
      if course_user.course != submission.assessment.course:
        raise http.Http404('Course user not consistent with the submission trying to be accessed.')

    if 'assessment_id' in kwargs and 'submission_id' in kwargs:
      # Note: If the stamement above evalues to true, we already have submission and assessment as
      # variables from the conditions above.
      if submission.assessment != assessment:
        raise http.Http404('Exam not consistent with the submission trying to be accessed.')

    if 'response_id' in kwargs:
      response_id = kwargs['response_id']
      response = shortcuts.get_object_or_404(models.Response, pk=response_id)
      if course_user.course != response.submission.assessment.course:
        raise http.Http404('Course user not consistent with the response trying to be accessed.')

    if 'submission_id' in kwargs and 'response_id' in kwargs:
      if submission != response.submission:
        raise http.Http404('Response not consistent with the assessment answer trying to be accessed.')

    if 'assessment_id' in kwargs and 'response_id' in kwargs:
      if assessment != response.submission.assessment:
        raise http.Http404('Response not consistent with the assessment trying to be accessed.')
    return fn(request, course_user, *args, **kwargs)

  return validate_course_user_assessment_consistency


def access_controlled(fn):
  """
  Calls:
  1. login_required
  2. valid_course_user_required
  3. consistent_course_user_assessment_required

  It DOES NOT check for instructor_required or instructor_or_ta_required etc.
  """
  return login_required(valid_course_user_required(consistent_course_user_assessment_required(fn)))


def student_required(fn):
  """ Returns the function below: """
  def validate_student(request, course_user, *args, **kwargs):
    """
    Validates that the current course user matches the user that the submission
    belongs to, or that the current course user is an instructor/TA.

    Should be chained with @valid_course_user_required (defined above), like so:

      @valid_course_user_required
      @student_required
      def view_fn():
        ...
    """
    if (course_user.privilege != models.CourseUser.INSTRUCTOR and
        course_user.privilege != models.CourseUser.TA and
        'submission_id' in kwargs):
      submission_id = kwargs['submission_id']
      submission = shortcuts.get_object_or_404(models.Submission, pk=submission_id)
      if submission.course_user != course_user:
        raise http.Http404('This submission doesn\'t seem to belong to you.')
    return fn(request, course_user, *args, **kwargs)

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
    other course. If so, calls fn. Otherwise, renders a 404 page.
    """
    if not request.user.is_instructor_for_any_course():
      raise http.Http404('Only valid instructors can create a new course.')
    return fn(request, *args, **kwargs)

  return validate_instructor_for_any_course


def submission_released_required(fn):
  """ Returns the function below: """
  def validate_submission_released(request, course_user, *args, **kwargs):
    """
    Validates that the submission corresponding to the given course user is
    released.
    """
    if course_user.privilege == models.CourseUser.STUDENT:
      if 'assessment_id' in kwargs:
        assessment_id = kwargs['assessment_id']
        # Can't do get_object_or_404 because multiple submissions might have been submitted
        submissions = models.Submission.objects.filter(assessment__id=assessment_id,
          course_user=course_user.pk, released=True)
        if submissions.count() == 0:
          raise http.Http404('No released submissions.')

      elif 'submission_id' in kwargs:
        submission_id = kwargs['submission_id']
        shortcuts.get_object_or_404(models.Submission,
          pk=submission_id, released=True)

    return fn(request, course_user, *args, **kwargs)

  return validate_submission_released
