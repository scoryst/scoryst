from rest_framework import serializers
from scorystapp import models
from django.utils import timezone
from django.db.models import Q


class QuestionPartSerializer(serializers.ModelSerializer):
  grade_down = serializers.BooleanField(source='assessment.grade_down', read_only=True)

  class Meta:
    model = models.QuestionPart


class ResponseSerializer(serializers.ModelSerializer):
  grader_name = serializers.CharField(source='grader.user.get_full_name', read_only=True)

  question_part = QuestionPartSerializer(read_only=True)

  def validate(self, attrs):
    """ Sets grader field if rubrics or custom points were changed. """
    new_rubrics = attrs.get('rubrics')
    new_custom_points = attrs.get('custom_points')

    new_rubrics = map(lambda rubric: rubric.pk, new_rubrics)
    rubrics = map(lambda rubric: rubric.pk, self.object.rubrics.all())

    if (not new_rubrics == rubrics or not new_custom_points ==
        self.object.custom_points):
      attrs['grader'] = self.context['course_user']
    return attrs

  def validate_grader(self, attrs, source):
    """
    Validates the following property: if the grader field is changed, the new
    grader must be the logged in user.
    """
    new_grader = attrs.get(source)
    if (not new_grader == self.object.grader and (
          new_grader == None or
          not new_grader.user == self.context['user'])):
      raise serializers.ValidationError('New grader must be the logged in user.')
    return attrs

  def validate_rubrics(self, attrs, source):
    """
    Validates that the given rubrics exist and correspond to the associated
    question part.
    """
    rubrics = attrs.get(source, [])

    for rubric in rubrics:
      # ensure each rubric exists
      if not rubric.question_part == self.object.question_part:
        raise serializers.ValidationError(
          'Invalid rubric for this question part: %d' % rubric.pk)

    return attrs

  class Meta:
    model = models.Response
    fields = ('id', 'question_part', 'pages', 'graded', 'grader_comments', 'grader',
      'grader_name', 'rubrics', 'custom_points', 'points')
    read_only_fields = ('id', 'pages', 'points', 'graded')


class RubricSerializer(serializers.ModelSerializer):
  def validate_question_part(self, attrs, source):
    """ Validates that the QuestionPart matches the one currently being viewed. """
    question_part = attrs.get(source)

    if not question_part == self.context['question_part']:
      raise serializers.ValidationError(
          'Rubric for invalid question part: %d' % question_part.pk)
    return attrs

  class Meta:
    model = models.Rubric
    fields = ('id', 'question_part', 'description', 'points')
    read_only_fields = ('id',)


class UserSerializer(serializers.ModelSerializer):
  class Meta:
    model = models.User
    fields = ('first_name', 'last_name', 'student_id')


class PrivilegeField(serializers.WritableField):
  """ Custom field to change privilege between string and int representation. """
  def to_native(self, obj):
    for privilege in models.CourseUser.USER_PRIVILEGE_CHOICES:
      if obj == privilege[0]:
        return privilege[1]

  def from_native(self, obj):
    for privilege in models.CourseUser.USER_PRIVILEGE_CHOICES:
      if obj == privilege[1]:
        return privilege[0]


class CourseUserSerializer(serializers.ModelSerializer):
  privilege = PrivilegeField()
  user = UserSerializer()
  is_current_user = serializers.SerializerMethodField('get_is_current_user')

  def get_is_current_user(self, course_user):
    """ Returns whether or not the course user is the current course user. """
    return course_user == self.context['course_user']

  class Meta:
    model = models.CourseUser
    fields = ('id', 'privilege', 'user', 'is_current_user', 'course')
    read_only_fields = ('id', 'course')


class SubmissionPageSerializer(serializers.ModelSerializer):
  page_jpeg_url = serializers.CharField(source='page_jpeg.url', read_only=True)
  page_jpeg_small_url = serializers.CharField(source='page_jpeg_small.url',
    read_only=True)
  responses = serializers.SerializerMethodField('get_responses')

  def get_responses(self, submission_page):
    pn = submission_page.page_number
    responses = models.Response.objects.filter(submission=submission_page.submission).filter(
      Q(pages__startswith='%d,' % pn) | Q(pages__endswith=',%d' % pn) | Q(pages__contains=',%d,' % pn) | Q(pages__exact='%d' % pn))
    qp_nums = [{'question_num': r.question_part.question_number, 'part_num': r.question_part.part_number} for r in responses]
    qp_nums = sorted(qp_nums, key=lambda qpn: (qpn['question_num'], qpn['part_num']))
    return qp_nums

  class Meta:
    model = models.SubmissionPage
    fields = ('id', 'page_number', 'page_jpeg_url', 'page_jpeg_small_url',
      'submission', 'responses')
    read_only_fields = ('id', 'page_number', 'submission')


class SubmitResponseSerializer(serializers.ModelSerializer):
  question_number = serializers.IntegerField(read_only=True,
    source='question_part.question_number')
  part_number = serializers.IntegerField(read_only=True,
    source='question_part.part_number')
  pages = serializers.RegexField(regex=r'\d+(,\d+)*', required=False)

  def validate_pages(self, attrs, source):
    """ Validates that the pages are in the correct range. """
    pages = attrs.get(source)
    if pages == None or pages == '':
      return attrs

    used_pages = {}
    pages = map(int, pages.split(','))
    num_pages = self.object.submission.page_count

    for page_num in pages:
      if page_num <= 0 or page_num > num_pages:
        raise serializers.ValidationError('Page %d is outside valid range.' % page_num)

      if page_num in used_pages:
        raise serializers.ValidationError('Cannot repeat page %d' % page_num)
      used_pages[page_num] = True

    return attrs

  class Meta:
    model = models.Response
    fields = ('id', 'pages', 'question_number', 'part_number')
    read_only_fields = ('id',)


class AnnotationSerializer(serializers.ModelSerializer):
  class Meta:
    model = models.Annotation
    fields = ('id', 'submission_page', 'rubric', 'comment', 'offset_top',
              'offset_left', 'render_latex')
    read_only_fields = ('id',)

  def validate_submission_page(self, attrs, source):
    """ Validates that the SubmissionPage matches the one currently being viewed. """
    submission_page = attrs.get(source)

    if submission_page != self.context['submission_page']:
      raise serializers.ValidationError(
        'Annotation for invalid response page: %d' % submission_page.pk)
    return attrs


class SubmissionSerializer(serializers.ModelSerializer):
  assessment_name = serializers.CharField(read_only=True, source='assessment.name')
  time = serializers.SerializerMethodField('get_time')
  pdf_url = serializers.CharField(read_only=True, source='pdf.url')
  is_finalized = serializers.BooleanField(read_only=True, source='is_finalized')

  def get_time(self, submission):
    return timezone.localtime(submission.time).strftime('%a, %b %d, %I:%M %p')

  class Meta:
    model = models.Submission
    fields = ('id', 'assessment_name', 'time', 'pdf_url', 'is_finalized')
    read_only_fields = ('id',)
