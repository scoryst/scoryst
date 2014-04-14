from rest_framework import serializers
from scorystapp import models


class ExamSerializer(serializers.ModelSerializer):
  class Meta:
    model = models.Exam
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

  exam_answer_id = serializers.SerializerMethodField('get_exam_answer_id')
  is_mapped = serializers.SerializerMethodField('get_is_mapped')
  questions_info = serializers.SerializerMethodField('get_questions_info')


  def get_exam_answer_id(self, course_user):
    """
    Returns exam_answer_id for the course_user if one exists, None otherwise.
    """
    exam_answers = filter(lambda ea: ea.exam == self.context['exam'],
      course_user.examanswer_set.all())
    return None if len(exam_answers) == 0 else exam_answers[0].pk


  def get_is_mapped(self, course_user):
    """
    Returns whether or not the course user is mapped to an exam answer for
    the given exam.
    """
    return False if self.get_exam_answer_id(course_user) == None else True


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

    exam = self.context['exam']
    num_questions = self.context['num_questions']

    exam_answers = filter(lambda ea: ea.exam == self.context['exam'],
      course_user.examanswer_set.all())

    if len(exam_answers) == 0:
      questions_info = [{
        'is_graded': False,
        'graders': ''
      }]
      return questions_info * (num_questions + 1)
    else:
      exam_answer = exam_answers[0]

    question_part_answer_set = exam_answer.questionpartanswer_set.all()
    is_exam_graded = True
    exam_graders = set()

    # loop over each question
    for i in range(1, num_questions + 1):
      question_part_answers = filter(lambda qp_answer: qp_answer.question_part.
        question_number == i, question_part_answer_set)

      graders = set()
      is_question_graded = True
      points = 0
      max_points = 0

      # Check if question is graded and find the graders
      for answer in question_part_answers:
        is_question_part_graded = answer.is_graded()
        is_question_graded = is_question_graded and is_question_part_graded

        points += answer.get_points()
        max_points += answer.question_part.max_points

        if is_question_part_graded:
          graders.add(answer.grader.user.get_full_name())

      exam_graders |= graders
      is_exam_graded = is_exam_graded and is_question_graded

      questions_info.append({
        'is_graded': is_question_graded,
        'graders': ', '.join(graders),
        'points': points,
        'max_points': max_points,
      })

    # Now add information about the entire exam
    questions_info[0] = {
      'is_graded': is_exam_graded,
      'graders': ', '.join(exam_graders),
      'points': exam_answer.get_points(),
      'max_points': exam_answer.get_max_points(),
    }
    return questions_info


  class Meta:
    model = models.CourseUser
    fields = ('id', 'full_name', 'student_id', 'email', 'is_mapped',
      'questions_info', 'exam_answer_id')
    read_only_fields = ('id',)
