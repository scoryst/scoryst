from boto.s3.connection import S3Connection
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from optparse import make_option
from scorystapp import models


class Command(BaseCommand):
  help = 'Backs up a source S3 bucket to a destination S3 bucket.'
  option_list = BaseCommand.option_list + (
    make_option('-s', '--source', help='Specify bucket source'),
    make_option('-d', '--destination', help="Specify bucket destination"),
    make_option('-c', '--create', action='store_true', help='Create the destination bucket')
  )

  def handle(self, *args, **options):
    conn = S3Connection(settings.AWS_S3_ACCESS_KEY_ID, settings.AWS_S3_SECRET_ACCESS_KEY)
    source_bucket, destination_bucket = self.get_buckets(conn, options['source'],
      options['destination'], options['create'])

    if not source_bucket or not destination_bucket:
      return

    print 'Copying bucket.'
    self.copy_bucket(source_bucket, destination_bucket, conn)


  def copy_bucket(self, source_bucket, destination_bucket, conn, maximum_keys=100):
    """ Copies the bucket. """
    for key in source_bucket.list():
      print 'Copying %s from %s to %s' % (key.key, source_bucket.name, destination_bucket.name)
      destination_bucket.copy_key(key.key, source_bucket.name, key.key)

    print 'Done backing up.'


  def get_buckets(self, conn, source, destination, create):
    """
    Returns (source_bucket, destination_bucket)
    Returns None if either the source bucket did not exist or destination bucket did not exist/
    you tried to create one that already existed.
    """
    destination_bucket = None

    source_bucket = conn.lookup(source)
    if not source_bucket:
      print 'Source bucket "%s" does not exist.' % source

    destination_bucket = conn.lookup(destination)

    if create and destination_bucket:
      print 'Destination bucket "%s" already exists.' % destination
      print 'Using this bucket to copy the source bucket.'
    elif create and not destination_bucket:
      try:
        conn.create_bucket(destination)
        print 'Created bucket %s.' % destination
        destination_bucket = conn.get_bucket(destination)
      except S3CreateError:
        print 'Somewhere in the world, this bucket already exists. Better name please?'
    elif not destination_bucket:
      print 'Destination bucket does not exist.'
      print 'Pass the -c flag if you want to create this bucket.'

    return source_bucket, destination_bucket
