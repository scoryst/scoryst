from rest_framework import serializers
from scorystapp import models


class AssessmentSerializer(serializers.ModelSerializer):
  class Meta:
    model = models.Assessment
    fields = ('id', 'name')
    read_only_fields = ('id', 'name')


class CourseUserGradedSerializer(serializers.ModelSerializer):
  """
  Used by grade overview giving details of each course user along with
  grader information for each question
  """
  full_name = serializers.CharField(source='user.get_full_name', read_only=True)
  student_id = serializers.CharField(source='user.student_id', read_only=True)
  email = serializers.CharField(source='user.email', read_only=True)

  submission_id = serializers.SerializerMethodField('get_submission_id')
  is_mapped = serializers.SerializerMethodField('get_is_mapped')
  questions_info = serializers.SerializerMethodField('get_questions_info')


  def get_submission_id(self, course_user):
    """
    Returns submission_id for the course_user if one exists, None otherwise.
    """
    submissions = filter(lambda ea: ea.assessment == self.context['assessment'],
      course_user.submission_set.all())
    return None if len(submissions) == 0 else submissions[0].pk


  def get_is_mapped(self, course_user):
    """
    Returns whether or not the course user is mapped to an assessment answer for
    the given assessment.
    """
    return False if self.get_submission_id(course_user) == None else True


  # TODO: Im still not happy with the way we treat questions, I'm doing aggregation
  # for questions for a single student for student summary in backbone, but im doing
  # this crap here. Should this be done in backbone too, after just returning
  # all the question part answers? Should the other thing be done in the backend
  # There's also some inconsistency in the way we do it. It's not a big deal for now
  # but it might be soon enough. Discuss with Karthik and Squishy.
  def get_questions_info(self, course_user):
    """
    0th index refers to all questions, index i refers to question i
    Returns a list where each element is {'is_graded', 'graders'}
    """
    questions_info = []

    # Index 0 refers to all questions and we fill it at the end
    questions_info.append({})

    assessment = self.context['assessment']
    num_questions = self.context['num_questions']

    submissions = filter(lambda ea: ea.assessment == self.context['assessment'],
      course_user.submission_set.all())

    if len(submissions) == 0:
      questions_info = [{
        'is_graded': False,
        'graders': ''
      }]
      return questions_info * (num_questions + 1)
    else:
      submission = submissions[0]

    # If the submission has not been released to the students, there should be no way
    # for the student to see his points
    if not submission.released and course_user.privilege == models.CourseUser.STUDENT:
      return []

    response_set = submission.response_set.all()
    is_assessment_graded = True
    assessment_graders = set()

    # loop over each question
    for i in range(1, num_questions + 1):
      responses = filter(lambda response: response.question_part.
        question_number == i, response_set)

      graders = set()
      is_question_graded = True
      points = 0
      max_points = 0

      # Check if question is graded and find the graders
      for answer in responses:
        is_question_part_graded = answer.is_graded()
        is_question_graded = is_question_graded and is_question_part_graded

        points += answer.get_points()
        max_points += answer.question_part.max_points

        if is_question_part_graded:
          graders.add(answer.grader.user.get_full_name())

      assessment_graders |= graders
      is_assessment_graded = is_assessment_graded and is_question_graded

      questions_info.append({
        'is_graded': is_question_graded,
        'graders': ', '.join(graders),
        'points': points,
        'max_points': max_points,
      })

    # Now add information about the entire assessment
    questions_info[0] = {
      'is_graded': is_assessment_graded,
      'graders': ', '.join(assessment_graders),
      'points': submission.get_points(),
      'max_points': submission.get_max_points(),
    }
    return questions_info


  class Meta:
    model = models.CourseUser
    fields = ('id', 'full_name', 'student_id', 'email', 'is_mapped',
      'questions_info', 'submission_id')
    read_only_fields = ('id',)
