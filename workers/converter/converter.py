import json
import subprocess
import threading
import PyPDF2
import worker
import requests

from boto.s3 import connection as s3
from PIL import Image

class Converter(worker.Worker):
  # number of pages to convert per batch
  PAGES_PER_BATCH = 15

  # norm threshold to determine if a page is a black
  BLANK_PAGE_THRESHOLD = 0.01


  def _work(self, payload):
    """
    Using ImageMagick, converts the given PDF to JPEGs. The PDF is passed in as
    a path in S3. Each page is read and converted to three JPEGs of different
    sizes (small, medium, and large). The JPEGs are then stored back in S3.

    Makes a POST request to the given webhook each time a page has been
    successfully uploaded. Passes in the page number that was uploaded and
    whether it was blank.

    Payload should be of the form:

    "s3": {
      "token": (string) S3 access token,
      "secret": (string) S3 access secret,
      "bucket": (string) S3 bucket name
    },

    "pdf_path": path to PDF to be converted,

    "jpeg_prefixes": [
      # page i of the PDF is stored under the names {jpeg_prefixes[i]}-small.jpg,
      # {jpeg_prefixes[i]}.jpg, and {jpeg_prefixes[i]}-large.jpg in S3
      (string) prefix for JPEG names for first PDF,
      (string) prefix for JPEG names for second PDF,
      ...
    ],

    "webhoook_url": (string) webhook URL to make a request to,
    "webhook_data": (*) data to return back to the webhook,

    "page_start": (int) first page of the PDF to convert (inclusive),
    "page_end": (int) last page of the PDF to convert (inclusive)
    """
    pdf_path = payload['pdf_path']
    jpeg_prefixes = payload['jpeg_prefixes']

    webhook_url = payload['webhook_url']
    webhook_data = payload['webhook_data']

    page_start = payload['page_start']
    page_end = payload['page_end']

    self._log('Connecting to s3')
    connection, bucket = self._connect_to_s3(payload['s3'])

    # create batches of pages to convert
    for batch_first_page in range(page_start, page_end + 1, self.PAGES_PER_BATCH):
      batch_last_page = min(batch_first_page + self.PAGES_PER_BATCH - 1, page_end)
      batch_pages = range(batch_first_page, batch_last_page + 1)

      batch_jpeg_prefixes = jpeg_prefixes[batch_first_page - page_start:
        batch_last_page + 1 - page_start]
      self._convert_batch(bucket, pdf_path, batch_pages, batch_jpeg_prefixes,
        webhook_url, webhook_data)


  def _connect_to_s3(self, credentials):
    """
    Connects to S3 with the given credentials. Returns a tuple of Boto
    (connection, bucket) objects.
    """
    connection = s3.S3Connection(credentials['token'], credentials['secret'])
    bucket = connection.get_bucket(credentials['bucket'])
    return connection, bucket


  def _convert_batch(self, bucket, pdf_path, pages, jpeg_prefixes,
      webhook_url, webhook_data):
    """ Converts the given batch of pages in the provided PDF to JPEGs. """
    # download PDF locally, use first JPEG prefix as its name
    pdf_key = s3.Key(bucket)
    pdf_key.key = pdf_path

    local_jpeg_prefix = jpeg_prefixes[0].replace('/', '-')
    local_pdf_path = '%s/%s.pdf' % (self.working_dir, local_jpeg_prefix)

    pdf_key.get_contents_to_filename(local_pdf_path)
    threads = []

    # convert each page in a separate thread using ImageMagick
    for page_number, jpeg_prefix in zip(pages, jpeg_prefixes):
      args = (local_pdf_path, page_number, jpeg_prefix, bucket, webhook_url,
          webhook_data)
      threads.append(threading.Thread(target=self._upload_page, args=args))

    [thread.start() for thread in threads]

    # wait until all threads have completed
    [thread.join() for thread in threads]


  def _upload_page(self, local_pdf_path, page_number, jpeg_prefix, bucket,
      webhook_url, webhook_data):
    """ Converts a page of the given PDF to JPEGs. Uploads the JPEGs to S3. """
    local_jpeg_prefix = jpeg_prefix.replace('/', '-')
    local_large_jpeg_path = '%s/%s-large.jpeg' % (self.working_dir,
      local_jpeg_prefix)
    local_small_jpeg_path = '%s/%s-small.jpeg' % (self.working_dir,
      local_jpeg_prefix)
    local_jpeg_path = '%s/%s.jpeg' % (self.working_dir, local_jpeg_prefix)

    subprocess.check_call(['convert', '-density', '300', '%s[%d]' %
      (local_pdf_path, page_number), local_large_jpeg_path])
    subprocess.check_call(['convert', '-resize', '800x800',
      local_large_jpeg_path, local_jpeg_path])
    subprocess.check_call(['convert', '-resize', '300x300',
      local_large_jpeg_path, local_small_jpeg_path])
    self._log('Finished converting page %d' % page_number)

    # store converted pages in S3
    large_jpeg_key = s3.Key(bucket)
    jpeg_key = s3.Key(bucket)
    small_jpeg_key = s3.Key(bucket)

    large_jpeg_key.key = '%s-large.jpeg' % (jpeg_prefix)
    jpeg_key.key = '%s.jpeg' % (jpeg_prefix)
    small_jpeg_key.key = '%s-small.jpeg' % (jpeg_prefix)

    large_jpeg_key.set_contents_from_filename(local_large_jpeg_path)
    jpeg_key.set_contents_from_filename(local_jpeg_path)
    small_jpeg_key.set_contents_from_filename(local_small_jpeg_path)

    large_jpeg_key.set_acl('public-read')
    jpeg_key.set_acl('public-read')
    small_jpeg_key.set_acl('public-read')

    self._log('Uploaded page %d' % page_number)
    self._call_webhook(webhook_url, webhook_data, local_jpeg_path, page_number)


  def _call_webhook(self, webhook_url, webhook_data, local_jpeg_path, page_number):
    """ Makes a POST request to the given webhook with upload data. """
    is_blank = False
    # read JPEG as black and white (only 0 or 255 intensities)
    local_jpeg = Image.open(local_jpeg_path).convert('1')
    intensities = list(local_jpeg.getdata())

    distance_from_white = 0
    for intensity in intensities:
      # white has an intensity of 255
      distance = intensity - 255
      distance_from_white += distance ** 2

    jpeg_size = local_jpeg.size[0] * local_jpeg.size[1]
    distance_from_white = (distance_from_white ** 0.5) / jpeg_size

    if distance_from_white < self.BLANK_PAGE_THRESHOLD:
      is_blank = True
      self._log('Detected %d as blank page' % page_number)

    data = {
      'webhook_data': webhook_data,
      'page_number': page_number,
      'is_blank': is_blank,
    }

    # note that we communicate back to the webhook via HTTPS, so no need to be
    # concerned with security (unless another heartbleed happens)
    requests.post(webhook_url, data=json.dumps(data), headers={'Content-type': 'application/json'})
    self._log('Sent webhook for page %d' % page_number)
