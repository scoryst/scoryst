from scorystapp import utils
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, \
  BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from model_utils.managers import InheritanceManager
from django.db.models import signals


"""
CourseUser Models
Models: UserManager, User, Course, CourseUser
"""

class UserManager(BaseUserManager):
  """ Manages the creation of user accounts. """

  @classmethod
  def normalize_email(cls, email):
    """ Converts the given email to lowercase. """
    return email.lower()

  def create_user(self, email, first_name, last_name, student_id, password=None,
        **extra_fields):
    """ Creates and saves a user with the given fields. """
    now = timezone.now()
    if not email:
        raise ValueError('The given email must be set.')

    email = UserManager.normalize_email(email)
    user = self.model(email=email, first_name=first_name, last_name=last_name,
                      student_id=student_id, is_staff=False, is_active=True,
                      is_superuser=False, last_login=now, date_joined=now,
                      **extra_fields)

    user.set_password(password)
    user.save(using=self._db)
    return user

  def create_superuser(self, email, first_name, last_name, student_id,
        password, **extra_fields):
    """ Creates and saves a superuser with the given fields. """
    user = self.create_user(email, first_name, last_name, student_id, password,
      **extra_fields)

    user.is_staff = True
    user.is_active = True
    user.is_superuser = True
    user.is_signed_up = True

    user.save(using=self._db)
    return user


class User(AbstractBaseUser, PermissionsMixin):
  """ Represents a user identified by an email/password combination. """
  # personal information
  email = models.EmailField(max_length=100, unique=True, db_index=True)
  first_name = models.CharField(max_length=30)
  last_name = models.CharField(max_length=30)

  # permissions
  is_staff = models.BooleanField(default=False,
      help_text='Designates whether the user can log into this admin site.')
  is_active = models.BooleanField(default=True,
      help_text='Designates whether this user should be treated as '
                'active. Unselect this instead of deleting accounts.')

  # student information
  student_id = models.CharField(max_length=100)
  is_signed_up = models.BooleanField(default=False)

  date_joined = models.DateTimeField(default=timezone.now)
  objects = UserManager()

  USERNAME_FIELD = 'email'
  REQUIRED_FIELDS = ['first_name', 'last_name', 'student_id']

  def get_full_name(self):
    """ Returns the full name (first + ' ' + last) of this user. """
    full_name = '%s %s' % (self.first_name, self.last_name)
    return full_name.strip()

  def get_short_name(self):
    """ Returns the first name of this user. Required for Django admin. """
    return self.first_name

  def get_initials(self):
    """ Returns the initials of this user. """
    return (self.first_name[0] + self.last_name[0]).upper()

  def is_instructor_for_any_course(self):
    """ Returns true if this user is an instructor for any course, or false otherwise. """
    return (CourseUser.objects.filter(user=self.pk, privilege=CourseUser.INSTRUCTOR)
      .count() > 0 or self.is_superuser)

  def __unicode__(self):
    return '%s (%s)' % (self.get_full_name(), self.student_id)

  class Meta(AbstractBaseUser.Meta):
    abstract = False


class Course(models.Model):
  """ Represents a particular course. Many users can be in a course. """
  # Enums for the term field
  FALL = 0
  WINTER = 1
  SPRING = 2
  SUMMER = 3
  TERM_CHOICES = (
    (FALL, 'Fall'),
    (WINTER, 'Winter'),
    (SPRING, 'Spring'),
    (SUMMER, 'Summer')
  )

  name = models.CharField(max_length=200)
  term = models.IntegerField(choices=TERM_CHOICES)
  year = models.IntegerField(default=timezone.now().year)

  student_enroll_token = models.CharField(max_length=10)
  ta_enroll_token = models.CharField(max_length=10)

  def has_assessments(self):
    """
    Returns true if Assessments are associated with this course, or false
    otherwise.
    """
    return self.assessment_set.count() > 0


  def has_exams(self):
    """
    Returns true if Exams are associated with this course, or false otherwise.
    """
    return self.assessment_set.filter(homework=None).count() > 0


  def has_homeworks(self):
    """
    Returns true if Homeworks are associated with this course, or false
    otherwise.
    """
    return self.assessment_set.filter(exam=None).count() > 0


  def get_truncated_year_string(self):
    """
    If year is 4 digits, replaces the first two digits with an apostrophe and
    returns the truncated year as a string. Otherwise, return the full year as a
    string.
    """
    year_str = ('%d' % self.year)
    if len(year_str) == 4:
      return '\'' + year_str[2:]
    return year_str


  def __unicode__(self):
    return '%s (%s %d)' % (self.name, self.TERM_CHOICES[self.term][1], self.year)


class CourseUser(models.Model):
  """ Represents a course that a user is in. """
  # Enums for the privilege field
  STUDENT = 0
  TA = 1
  INSTRUCTOR = 2
  USER_PRIVILEGE_CHOICES = (
    (STUDENT, 'Student'),
    (TA, 'TA'),
    (INSTRUCTOR, 'Instructor')
  )

  USER_LOWERCASE_DISPLAY_CHOICES = (
    (STUDENT, 'student'),
    (TA, 'TA'),
    (INSTRUCTOR, 'instructor')
  )

  # The actual model fields
  user = models.ForeignKey(User, db_index=True)
  course = models.ForeignKey(Course, db_index=True)
  privilege = models.IntegerField(choices=USER_PRIVILEGE_CHOICES, default=STUDENT)


  def __unicode__(self):
    return '%s (%s)' % (self.user.get_full_name(),
      self.USER_PRIVILEGE_CHOICES[self.privilege][1])


"""
Assessment Models
Models: Assessment, Exam, Homework, ExamPage, QuestionPart, Rubric
"""

class Assessment(models.Model):
  """ Represents a particular exam or homework associated with a course. """
  def generate_remote_pdf_name(instance, filename):
    """ Generates a name of the form `filename`/<random_string><timestamp>.pdf """
    return utils.generate_timestamped_random_name(filename, 'pdf')

  course = models.ForeignKey(Course, db_index=True)
  name = models.CharField(max_length=200)

  # Whether the assessment is being graded up or graded down
  grade_down = models.BooleanField(default=True)
  cap_score = models.BooleanField(default=True)

  solutions_pdf = models.FileField(upload_to=generate_remote_pdf_name, blank=True, null=True)

  objects = InheritanceManager()

  def get_num_questions(self):
    """ Returns the number of questions in this exam. """
    question_parts = self.questionpart_set.order_by('-question_number')
    if question_parts.count() > 0:
      return question_parts[0].question_number
    return 0

  def get_points(self):
    question_parts = self.questionpart_set.all()
    points = 0
    for question_part in question_parts:
      points += question_part.max_points
    return points

  def get_prefetched_submissions(self):
    """
    Returns the set of exam answers corresponding to this exam. Prefetches all
    fields necessary to compute is_graded() and get_points().
    """
    return self.submission_set.filter(preview=False, last=True).prefetch_related(
      'response_set',
      'response_set__question_part',
      'response_set__submission__assessment'
    )

  def get_prefetched_question_parts(self):
    """
    Returns the set of question parts corresponding to this exam. Prefetches
    all fields necessary to compute is_graded() and get_points().
    """
    return self.questionpart_set.prefetch_related(
      'response_set',
      'response_set__question_part',
      'response_set__submission__assessment'
    )

  def __unicode__(self):
    return '%s (%s)' % (self.name, self.course.name)


class Exam(Assessment):
  """ Represents a particular exam associated with a course. """
  def generate_remote_pdf_name(instance, filename):
    """ Generates a name of the form exam-pdf/<random_string><timestamp>.pdf """
    return utils.generate_timestamped_random_name('exam-pdf', 'pdf')

  page_count = models.IntegerField()
  # Blank is allowed because exam_pdf is loaded asynchronously and the
  # exam needs to be saved before it is fully loaded
  exam_pdf = models.FileField(upload_to=generate_remote_pdf_name, blank=True)


class Homework(Assessment):
  """ Represents a particular homework assignment associated with the course. """
  submission_deadline = models.DateTimeField()


class ExamPage(models.Model):
  """ JPEG representation of one page of the exam """
  def generate_remote_jpeg_name(instance, filename):
    """ Generates a name of the form exam-jpeg/<random_string><timestamp>.jpeg """
    return utils.generate_timestamped_random_name('exam-jpeg', 'jpeg')

  exam = models.ForeignKey(Exam, db_index=True)
  page_number = models.IntegerField()
  page_jpeg = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)
  page_jpeg_large = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)

  def __unicode__(self):
    return '%s (Page %d)' % (self.exam.name, self.page_number,)


class QuestionPart(models.Model):
  """ Represents a particular question/part associated with an exam. """

  assessment = models.ForeignKey(Assessment, db_index=True)

  question_number = models.IntegerField()
  part_number = models.IntegerField(null=True)

  max_points = models.FloatField()
  # For homework, we don't associate a `question_part` with pages, only the
  # `response` is associated with pages. This is because for most homeworks,
  # student responses can be of arbitrary length and they do the response to page
  # mapping themselves
  pages = models.CommaSeparatedIntegerField(max_length=200,
    null=True, blank=True)

  def save(self, *args, **kwargs):
    """
    If points associated with a question_part changes, due to capping, we need to
    recompute all of the responses' points field.
    """
    super(QuestionPart, self).save(*args, **kwargs)
    responses = models.Response.objects.filter(question_part=self)
    [response.update_response() for response in responses]

  def __unicode__(self):
    return 'Q%d.%d (%d Point(s))' % (self.question_number, self.part_number,
      self.max_points)


class Rubric(models.Model):
  """ Represents a grading criterion associated with a question. """
  question_part = models.ForeignKey(QuestionPart, db_index=True)
  description = models.CharField(max_length=200)
  points = models.FloatField()

  def save(self, *args, **kwargs):
    """
    When a rubric is updated, re-compute the points for each response for which
    the rubric was selected.
    """
    super(Rubric, self).save(*args, **kwargs)
    responses = Response.objects.filter(rubrics__id=self.id)
    [response.update_response() for response in responses]

  def __unicode__(self):
    return 'Q%d.%d ("%s")' % (self.question_part.question_number,
      self.question_part.part_number, self.description)


"""
Submission Models
Models: Submission, Submission, Response
"""

class Submission(models.Model):
  """ Represents a student's assessment (homework or exam). """
  def generate_remote_pdf_name(instance, filename):
    """ Generates a name of the form `filename`/<random_string><timestamp>.pdf """
    return utils.generate_timestamped_random_name(filename, 'pdf')

  assessment = models.ForeignKey(Assessment, db_index=True)
  course_user = models.ForeignKey(CourseUser, null=True, blank=True, db_index=True)

  page_count = models.IntegerField()
  pdf = models.FileField(upload_to=generate_remote_pdf_name)
  time = models.DateTimeField(null=True, blank=True)

  released = models.BooleanField(default=False)
  preview = models.BooleanField(default=False)
  last = models.BooleanField(default=True)

  points = models.FloatField(default=0)
  graded = models.BooleanField(default=False)

  def _is_graded(self):
    """ Returns true if this exam is graded, or false otherwise. """
    responses = self.response_set.all()
    for response in responses:
      if not response._is_graded():
        return False
    return True

  def get_question_points(self, question_number):
    """ Returns the total number of points the student received on this question_number. """
    responses = self.response_set.all()
    responses = filter(lambda response: response.question_part.question_number
      == question_number, responses)

    return sum([response.points for response in responses])

  def is_question_graded(self, question_number):
    """ Returns true if this exam is graded, or false otherwise. """
    responses = self.response_set.all()
    responses = filter(lambda response: response.question_part.question_number
      == question_number, responses)

    return all([response.graded for response in responses])

  def is_finalized(self):
    """ Returns true if there are no unmapped responses. """
    unmapped_responses = self.response_set.filter(pages=None)
    return unmapped_responses.count() == 0

  def __unicode__(self):
    if self.course_user:
      return '%s (%s)' % (self.assessment.name, self.course_user.user.get_full_name())
    else:
      return '%s (unmapped)' % self.assessment.name


class SubmissionPage(models.Model):
  """ JPEG representation of one page of the students assessment answer """
  def generate_remote_jpeg_name(instance, filename):
    """ Generates a name of the form assessment-answer-jpeg/<random_string><timestamp>.jpeg """
    return utils.generate_timestamped_random_name('assessment-answer-jpeg', 'jpeg')

  submission = models.ForeignKey(Submission, db_index=True)
  page_number = models.IntegerField()
  page_jpeg = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)
  page_jpeg_small = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)
  page_jpeg_large = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)
  is_blank = models.BooleanField(default=False)

  def __unicode__(self):
    if self.submission.course_user:
      return '%s\'s %s (Page %d)' % (self.submission.course_user.user.get_full_name(),
        self.submission.assessment.name, self.page_number)
    else:
      return 'unmapped\'s %s (Page %d)' % (self.submission.exam.name, self.page_number)


class Response(models.Model):
  """ Represents a student's answer to a question/part. """
  submission = models.ForeignKey(Submission, db_index=True)

  question_part = models.ForeignKey(QuestionPart, db_index=True)
  pages = models.CommaSeparatedIntegerField(max_length=200, null=True,
    blank=True)

  grader_comments = models.TextField(null=True, blank=True, max_length=1000)
  grader = models.ForeignKey(CourseUser, null=True, blank=True, db_index=True)

  rubrics = models.ManyToManyField(Rubric)
  custom_points = models.FloatField(null=True, blank=True)

  points = models.FloatField(default=0)
  graded = models.BooleanField(default=False)

  def update_response(self):
    """ Compute `points` and `graded` fields """
    old_points = self.points
    old_graded = self.graded

    self.points = self._get_points()
    self.graded = self._is_graded()
    self.save()

    self.submission.points += self.points - old_points
    # We just ungraded a response
    if self.submission.graded and not self.graded:
      self.submission.graded = False

    # The response was just graded, so maybe the submission is now fully graded
    if not self.submission.graded and self.graded:
      self.submission.graded = self.submission._is_graded()

    self.submission.save()

  def _is_graded(self):
    """ Returns true if this question part answer is graded, or false otherwise. """
    return self.rubrics.count() > 0 or self.custom_points is not None

  def _get_points(self):
    """ Returns the number of points the student received for this answer. """
    # sum all rubric points
    total_points = 0
    for rubric in self.rubrics.all():
      total_points += rubric.points

    custom_points = self.custom_points if self.custom_points else 0
    if self.submission.assessment.grade_down:
      # if we're grading down, subtract total from max points
      points = self.question_part.max_points - total_points + custom_points
    else:
      # otherwise, we're awarding points
      points = total_points + custom_points

    if self.submission.assessment.cap_score:
      # assessments where grade down is the option caps score to be non-negative
      if self.submission.assessment.grade_down:
        points = max(0, points)
      else:  # if grade up, scores cannot exceed the maximum
        points = min(self.question_part.max_points, points)
    return points

  def __unicode__(self):
    if self.submission.course_user:
      return '%s\'s Q%d.%d Answer' % (self.submission.course_user.user.get_full_name(),
        self.question_part.question_number, self.question_part.part_number)
    else:
      return '(unmapped)\'s Q%d.%d Answer' % (self.question_part.question_number,
        self.question_part.part_number)


def rubrics_changed(sender, instance, action, **kwargs):
  """
  `rubrics` is a many to many field for response. This handler will be
  called whenever the rubrics associated with a response change. We update
  `points` and `graded` fields associated with the response.
  NOTE: The above arguments are keyword arguments and can't be renamed.
  NOTE: Even when the custom points are changed this works for now, because
  the way serializers are implemented, a change in custom_points still triggers
  post_clear, post_add etc. in the `rubrics` field.
  """
  if action == 'post_add' or action == 'post_remove' or action == 'post_clear':
    instance.update_response()

signals.m2m_changed.connect(rubrics_changed, sender=Response.rubrics.through)


class Annotation(models.Model):
  """ Represents an annotation for a student's exam answer page. """
  submission_page = models.ForeignKey(SubmissionPage, db_index=True)

  # One of the rubric and comment fields should not be null
  rubric = models.ForeignKey(Rubric, null=True, blank=True, db_index=True)
  comment = models.TextField(null=True, blank=True, max_length=1000)

  offset_top = models.FloatField()
  offset_left = models.FloatField()

  render_latex = models.BooleanField(default=False)


"""
Split Models
Models: Split, SplitPage
"""

class Split(models.Model):
  """
  Represents a pdf file that has been uploaded but not yet "split" into Submissions
  If N pages were part of a PDF file that was uploaded, we have N `SplitPage`s as
  part of one `Split`
  """
  def generate_remote_pdf_name(instance, filename):
    """ Generates a name of the form split-pdf/<random_string><timestamp>.pdf """
    return utils.generate_timestamped_random_name('split-pdf', 'pdf')

  exam = models.ForeignKey(Exam, db_index=True)
  pdf = models.FileField(upload_to=generate_remote_pdf_name)
  secret = models.TextField(max_length=1000)


class SplitPage(models.Model):
  """
  Represents a page from the `Split` pdf that is yet to be associated with
  a `Submission`
  """
  def generate_remote_jpeg_name(instance, filename):
    """ Generates a name of the form split-jpeg/<random_string><timestamp>.jpeg """
    return utils.generate_timestamped_random_name('split-jpeg', 'jpeg')

  split = models.ForeignKey(Split, db_index=True)
  page_number = models.IntegerField()
  is_uploaded = models.BooleanField(default=False)
  is_blank = models.BooleanField(default=False)
  begins_submission = models.BooleanField(default=False)

  # Upload URLs are taken care of by upload.py, however upload_to is required
  # so we specify none
  page_jpeg = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)
  page_jpeg_small = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)
  page_jpeg_large = models.ImageField(upload_to=generate_remote_jpeg_name, blank=True)
