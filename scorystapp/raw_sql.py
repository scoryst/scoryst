from django.db import connection

def get_question_points_and_num_parts_graded(submission_set, question_number):
  """
  Returns a list of (points, num_graded) tuples where num_graded is the number
  of parts that were graded for the question
  """
  submission_ids = submission_set.values_list('id', flat=True)

  cursor = connection.cursor()
  query = ("SELECT SUM(points) as total, COUNT(points) as count FROM scorystapp_response" +
    " INNER JOIN scorystapp_questionpart ON question_part_id = scorystapp_questionpart.id" +
    " WHERE graded = TRUE and question_number = %d AND submission_id IN (%s)" +
    " GROUP BY submission_id")

  cursor.execute(query % (question_number, ','.join(map(str, submission_ids))))
  results = cursor.fetchall()
  return results
