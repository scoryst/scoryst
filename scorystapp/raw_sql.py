from django.db import connection

def get_question_info(submission_set, question_number,
    num_question_parts):
  submission_ids = submission_set.values_list('id', flat=True)

  cursor = connection.cursor()
  query = ("SELECT SUM(scorystapp_response.points) as total,"
    " COUNT(scorystapp_response.points) as count,"
    " SUM(scorystapp_questionpart.max_points) as max_points, course_user_id,"
    " submission_id FROM scorystapp_response INNER JOIN scorystapp_questionpart"
    " ON question_part_id = scorystapp_questionpart.id INNER JOIN"
    " scorystapp_submission ON submission_id = scorystapp_submission.id WHERE"
    " scorystapp_response.graded = TRUE and question_number = %d AND"
    " submission_id IN (%s) GROUP BY submission_id, course_user_id")

  submission_ids_str = map(str, submission_ids)
  cursor.execute(query % (question_number, ','.join(submission_ids_str)))
  results = cursor.fetchall()

  question_info_dict = {}
  for row in results:
    submission_id = row[4]
    question_info_dict[submission_id] = {
      'points': row[0],
      'graded': row[1] == num_question_parts,
      'max_points': row[2],
      'course_user_id': row[3],
      'submission_id': row[4],
      'graders': [],
    }

  query = ("SELECT DISTINCT CONCAT(first_name, ' ', last_name) as full_name,"
    " submission_id FROM scorystapp_user INNER JOIN scorystapp_courseuser ON"
    " user_id = scorystapp_user.id INNER JOIN scorystapp_response ON grader_id"
    " = scorystapp_courseuser.id INNER JOIN scorystapp_questionpart ON"
    " question_part_id = scorystapp_questionpart.id WHERE question_number = %d"
    " AND submission_id IN (%s)")

  cursor.execute(query % (question_number, ','.join(submission_ids_str)))
  results = cursor.fetchall()

  for row in results:
    grader_name = row[0]
    submission_id = row[1]

    matching_question_info = question_info_dict[submission_id]
    matching_question_info['graders'].append(grader_name)

  return question_info_dict.values()


def get_graded_question_scores(submission_set, question_number,
    num_question_parts):
  """
  Returns a list of (points, num_graded) tuples where num_graded is the number
  of parts that were graded for the question
  """
  submission_ids = submission_set.values_list('id', flat=True)

  cursor = connection.cursor()
  query = ("SELECT SUM(points) as total, COUNT(points) as count FROM"
    " scorystapp_response INNER JOIN scorystapp_questionpart ON"
    " question_part_id = scorystapp_questionpart.id WHERE graded = TRUE and"
    " question_number = %d AND submission_id IN (%s) GROUP BY submission_id")

  submission_ids_str = map(str, submission_ids)
  cursor.execute(query % (question_number, ','.join(submission_ids_str)))
  results = cursor.fetchall()

  graded_question_scores = [row[0] for row in results if
    row[1] == num_question_parts]
  return graded_question_scores
