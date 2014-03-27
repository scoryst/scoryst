from boto.s3.connection import S3Connection
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from optparse import make_option
from scorystapp import models


class Command(BaseCommand):
  help = 'Backs everything in source to destination'
  option_list = BaseCommand.option_list + (
    make_option(
      "-s",
      "--source",
      help="Specify bucket source",
    ),

    make_option(
      "-d",
      "--destination",
      help="Specify bucket destination",
    ),

    make_option(
      "-c",
      "--create",
      action="store_true",
      help="Create the destination bucket",
    ),
  )

  def handle(self, *args, **options):
    conn = S3Connection(settings.AWS_S3_ACCESS_KEY_ID, settings.AWS_S3_SECRET_ACCESS_KEY)

    source_bucket, destination_bucket = self.get_buckets(conn, options['source'],
      options['destination'], options['create'])

    if not source_bucket or not destination_bucket:
      return

    print 'Copying bucket.'
    self.copy_bucket(source_bucket, destination_bucket, conn)


  def copy_bucket(self, source_bucket, destination_bucket, conn, maximum_keys = 100):
    """ Copies the bucket. """
    result_marker = ''
    while True:
      keys = source_bucket.get_all_keys(max_keys=maximum_keys, marker=result_marker)

      for key in keys:
        print 'Copying %s from %s to %s' % (key.key, source_bucket.name, destination_bucket.name)
        destination_bucket.copy_key(key.key, source_bucket.name, key.key)

      if len(keys) < maximum_keys:
        print 'Done backing up.'
        break

      result_marker = keys[maximum_keys - 1].key


  def get_buckets(self, conn, source, destination, create):
    """
    Returns (source_bucket, destination_bucket)
    Returns None if either failed
    """
    source_bucket = None
    destination_bucket = None
    try:
      source_bucket = conn.get_bucket(source)
    except:
      self.stdout.write('Source bucket does not exist.')

    if not create:
      try:
        destination_bucket = conn.get_bucket(destination)
      except:
        print 'Destination bucket does not exist.'
        print 'Pass the -c flag if you want to create this bucket.'
    else:
      try:
        conn.create_bucket(destination)
        destination_bucket = conn.get_bucket(destination)
      except:
        print 'Somewhere in the world, this bucket already exists. Better name please?'

    return source_bucket, destination_bucket
