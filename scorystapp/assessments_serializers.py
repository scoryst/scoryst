import pytz
from rest_framework import serializers
from scorystapp import models


class AssessmentSerializer(serializers.ModelSerializer):
  is_exam = serializers.SerializerMethodField('get_is_exam')
  solutions_pdf = serializers.SerializerMethodField('get_solutions_pdf')
  can_edit = serializers.SerializerMethodField('get_can_edit')

  # Only valid if the assessment is an exam (else None)
  page_count = serializers.SerializerMethodField('get_page_count')
  exam_pdf = serializers.SerializerMethodField('get_exam_pdf')

  # Only valid if the assessment is a homework (else None)
  submission_deadline = serializers.SerializerMethodField('get_submission_deadline')

  def get_is_exam(self, assessment):
    return hasattr(assessment, 'exam')

  def get_page_count(self, assessment):
    if self.get_is_exam(assessment):
      return assessment.exam.page_count
    return None

  def get_solutions_pdf(self, assessment):
    """
    Returns URL for solutions PDF. Since there is a delay in uploading the file,
    it is possible that the url has not yet been set. Catch the error.
    """
    try:
      return assessment.solutions_pdf.url if assessment.solutions_pdf else None
    except ValueError:
      return None

  def get_exam_pdf(self, assessment):
    """
    Returns URL for exam PDF. Since there is a delay in uploading the file, it
    is possible that the url has not yet been set. Catch the error.
    """
    if self.get_is_exam(assessment):
      try:
        return assessment.exam.exam_pdf.url
      except ValueError:
        return None
    return None

  def get_submission_deadline(self, assessment):
    """ Submission deadline is a string returning the time in PST. """
    if hasattr(assessment, 'homework'):
      tz = pytz.timezone('US/Pacific')
      return assessment.homework.submission_deadline.astimezone(tz).strftime('%m/%d/%Y %H:%M')
    return None

  def get_can_edit(self, assessment):
    """ Editing an assessment is only possible if there are no submissions. """
    return models.Submission.objects.filter(assessment=assessment).count() == 0

  class Meta:
    model = models.Assessment
    fields = ('id', 'name', 'course', 'is_exam', 'page_count', 'solutions_pdf',
              'submission_deadline', 'exam_pdf', 'can_edit')
    read_only_fields = ('id', 'name', 'course', 'grade_down')


class QuestionPartSerializer(serializers.ModelSerializer):
  def validate_assessment(self, attrs, source):
    """ Validates that the QuestionPart matches the one currently being viewed. """
    assessment = attrs.get(source)

    if not assessment == self.context['assessment']:
      raise serializers.ValidationError('Rubric for invalid assessment: %d' % assessment.pk)
    return attrs

  class Meta:
    model = models.QuestionPart
    fields = ('id', 'assessment', 'question_number', 'part_number', 'max_points', 'pages')
    read_only_fields = ('id', 'assessment', 'question_number', 'part_number',
                        'max_points', 'pages')
