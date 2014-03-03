from rest_framework import serializers
from scorystapp import models

class QuestionPartSerializer(serializers.ModelSerializer):
  grade_down = serializers.BooleanField(source='exam.grade_down', read_only=True)

  class Meta:
    model = models.QuestionPart


class QuestionPartAnswerSerializer(serializers.ModelSerializer):
  is_graded = serializers.CharField(source='is_graded', read_only=True)
  grader_name = serializers.CharField(source='grader.user.get_full_name', read_only=True)

  question_part = QuestionPartSerializer(read_only=True)
  points = serializers.FloatField(source='get_points', read_only=True)

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
    model = models.QuestionPartAnswer
    fields = ('id', 'question_part', 'pages', 'is_graded', 'grader_comments', 'grader',
      'grader_name', 'rubrics', 'custom_points', 'points')
    read_only_fields = ('id', 'pages')


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


class ExamAnswerPageSerializer(serializers.ModelSerializer):
  class Meta:
    model = models.ExamAnswerPage
    fields = ('id', 'page_number')
    read_only_fields = ('id', 'page_number')

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


class AnnotationSerializer(serializers.ModelSerializer): 
  class Meta:
    model = models.Annotation
    fields = ('id', 'exam_answer_page', 'question_part_answer', 'rubric', 'comment',
      'offset_top', 'offset_left')
    read_only_fields = ('id',)

  def validate(self, attrs):
    """
    Validates that the exam_answer_page and the question_part_answer correspond to
    the same exam.
    """
    exam_answer_page = attrs.get('exam_answer_page')
    question_part_answer = attrs.get('question_part_answer')
    if exam_answer_page.exam_answer != question_part_answer.exam_answer:
      raise serializers.ValidationError('The exam answer page and question '
        'part answer do not share the same exam')
    return attrs
