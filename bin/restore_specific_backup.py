#!/usr/bin/env python
import sys
import os

# make scorystapp files accessible
directory = os.path.join(os.path.dirname(__file__), '..')
sys.path.append(os.path.abspath(directory))

from django.core import management
from scorystproject import settings as scoryst_settings
from datetime import datetime
from boto.s3 import connection as s3
from boto import utils
import time
import subprocess


def restore_backup(days_ago):
  """
  Restores the last backup that is at least `days_ago` days old.
  """
  # set up django environment
  management.setup_environ(scoryst_settings)
  from django.conf import settings

  connection = s3.S3Connection(settings.AWS_S3_ACCESS_KEY_ID,
    settings.AWS_S3_SECRET_ACCESS_KEY)
  bucket = connection.get_bucket(settings.AWS_PRODUCTION_BACKUPS_BUCKET_NAME)

  keys = bucket.list()
  key = get_last_key(keys, days_ago)

  if key == None:
    print 'No key found to take a backup from!'
    return

  # Fetch backup from S3. Macs can't handle ':' in file names, so we replace them.
  temp_file_name = '/tmp/%s' % key.name
  print 'Fetching file %s to %s' % (key.name, temp_file_name)
  key.get_contents_to_filename(temp_file_name)

  # restore backup
  print 'Restoring backup...'
  print subprocess.check_output(['psql', '-f', temp_file_name, 'postgres'])


def get_last_key(keys, days_ago):
  """ Loops over the keys and finds the last key that is at least `days_ago` old. """
  last_key = None
  cur_time_in_seconds = time.mktime(time.gmtime())
  min_difference_in_days = float('inf')
  SECONDS_IN_DAY = 60 * 60 * 24

  for key in keys:
    # Get the time of last modification of the key, in seconds
    parsed_datetime = utils.parse_ts(key.last_modified)
    time_in_seconds = time.mktime(parsed_datetime.timetuple())

    difference_in_days = (cur_time_in_seconds - time_in_seconds) / float(SECONDS_IN_DAY)
    # We want the latest backup that is at least `day_ago` old
    if difference_in_days < min_difference_in_days and difference_in_days > days_ago:
      last_key = key
      min_difference_in_days = difference_in_days

  return last_key


if __name__ == '__main__':
  if len(sys.argv) != 2:
    print 'Usage: python restore_specific_backup.py days_ago'
    print 'where days_ago is a float that specifies how far back in time we wish to go'
  else:
    restore_backup(float(sys.argv[1]))
