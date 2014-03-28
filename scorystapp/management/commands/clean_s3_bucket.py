from boto.s3.connection import S3Connection
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from optparse import make_option
from scorystapp import models


class Command(BaseCommand):
  help = 'Deletes everything in the bucket that is not a jpeg/pdf associated with a model'
  option_list = BaseCommand.option_list + (
    make_option('-b', '--bucketname', help='Specify bucket name'),
    make_option('-r', '--real', action='store_true', help='Actually deletes instead of a dry run')
  )

  def handle(self, *args, **options):
    conn = S3Connection(settings.AWS_S3_ACCESS_KEY_ID, settings.AWS_S3_SECRET_ACCESS_KEY)
    bucket = conn.lookup(options['bucketname'])
    if not bucket:
      print 'Bucket "%s" does not exist' % options['bucketname']
      return

    print 'Getting list of keys used by database'
    local_keys = self.get_all_keys_in_use()

    print 'Getting all keys in S3'
    s3_keys = bucket.list()

    print 'Starting deletion'
    useless_key = 0
    total_keys = 0
    for key in s3_keys:
      if key.name not in local_keys:
        if options['real']:
          print 'Useless key ', key
          key.delete()
        useless_key += 1
      total_keys += 1

    print 'Num useless keys: ', useless_key
    print 'Total keys: ', total_keys

    print 'Done deleting.'


  def get_all_keys_in_use(self):
    """
    Get all the keys that are associated with some model in the database as a
    jpeg or pdf
    """
    keys = []

    # Get all keys associated with ExamAnswerPage page_jpeg and page_jpeg_large
    exam_answer_pages = models.ExamAnswerPage.objects.all()
    for exam_answer_page in exam_answer_pages:
      keys.append(exam_answer_page.page_jpeg.name)
      keys.append(exam_answer_page.page_jpeg_large.name)

    # Get all keys associated with ExamPage page_jpeg and page_jpeg_large
    exam_pages = models.ExamPage.objects.all()
    for exam_page in exam_pages:
      keys.append(exam_page.page_jpeg.name)
      keys.append(exam_page.page_jpeg_large.name)

    # Get all keys associated with Exam exam_pdf and solutions_pdf
    exams = models.Exam.objects.all()
    for exam in exams:
      keys.append(exam.exam_pdf.name)
      keys.append(exam.solutions_pdf.name)

    # Get all keys associated with ExamAnswer pdf
    exam_answers = models.ExamAnswer.objects.all()
    for exam_answer in exam_answers:
      keys.append(exam_answer.pdf.name)

    return set(keys)
