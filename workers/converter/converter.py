from boto.s3 import connection as s3
import requests
import subprocess
import PyPDF2
import threading
import worker
import numpy as np
import Image

class Converter(worker.Worker):
  BLANK_PAGE_THRESHOLD = 0.02

  def _work(self, payload):
    """
    Using ImageMagick, converts the given PDFs to JPEGs. PDFs are passed as paths
    in S3. They're read from S3, converted to JPEGs, and stored back in S3.

    Payload should be of the form:

    "s3": {
      "token": (string) S3 access token,
      "secret": (string) S3 access secret,
      "bucket": (string) S3 bucket name
    },

    "pdf_paths": [
      (string) path to first PDF to be converted,
      (string) path to second PDF to be converted,
      ...
    ],

    "jpeg_prefixes": [
      # if prefix is 'pre', JPEGs stored in S3 will be named 'pre1.jpeg', 'pre2.jpeg', etc.
      (string) prefix for JPEG names for first PDF,
      (string) prefix for JPEG names for second PDF,
      ...
    ]
    """
    jpeg_prefixes = payload['jpeg_prefixes']
    exam_answer_ids = payload['exam_answer_ids']
    webhook_secret = payload['webhook_secret']
    webhook_url = payload['webhook_url']

    self._log('Connecting to s3')
    connection, bucket = self._connect_to_s3(payload['s3'])

    # convert each PDF in a separate thread
    for index, pdf_path in enumerate(payload['pdf_paths']):
      self._convert_pdf(bucket, pdf_path, jpeg_prefixes[index],
        exam_answer_ids[index], webhook_secret, webhook_url)


  def _connect_to_s3(self, credentials):
    """
    Connects to S3 with the given credentials. Returns a tuple of Boto
    (connection, bucket) objects.
    """
    connection = s3.S3Connection(credentials['token'], credentials['secret'])
    bucket = connection.get_bucket(credentials['bucket'])
    return connection, bucket


  def _convert_pdf(self, bucket, pdf_path, jpeg_prefix, exam_answer_id,
    webhook_secret, webhook_url):
    """
    Converts the PDF in S3 given by pdf_path to JPEGs. For each page in the PDF,
    stores a JPEG by name "[jpeg_prefix][pdf_page_number].jpeg" in S3. bucket
    represents the Boto S3 bucket object.
    """
    # download PDF locally
    pdf_key = s3.Key(bucket)
    pdf_key.key = pdf_path

    local_jpeg_prefix = jpeg_prefix.replace('/', '-')
    local_pdf_path = '%s/%s.pdf' % (self.working_dir, local_jpeg_prefix)
    pdf_key.get_contents_to_filename(local_pdf_path)

    # get number of pages
    with open(local_pdf_path, 'rb') as handle:
      pdf_reader = PyPDF2.PdfFileReader(handle)
      num_pages = pdf_reader.getNumPages()

    threads = []

    # convert each page in a separate thread using ImageMagick
    for page_number in range(0, num_pages):
      local_large_jpeg_path = '%s/%s%d-large.jpeg' % (self.working_dir,
        local_jpeg_prefix, page_number + 1)
      local_jpeg_path = '%s/%s%d.jpeg' % (self.working_dir, local_jpeg_prefix,
        page_number + 1)

      # single-threaded:
      # self._upload_page(local_pdf_path, page_number, local_jpeg_path, bucket, jpeg_prefix)

      # multi-threaded:
      threads.append(threading.Thread(target=self._upload_page_and_detect_blank, args=(local_pdf_path,
        page_number, local_large_jpeg_path, local_jpeg_path, bucket, jpeg_prefix,
        webhook_url, webhook_secret)))

    [thread.start() for thread in threads]

    # wait until all threads have complete
    [thread.join() for thread in threads]


  def _upload_page_and_detect_blank(self, local_pdf_path, page_number, local_large_jpeg_path,
      local_jpeg_path, bucket, jpeg_prefix, webhook_url, webhook_secret):
    """
    Converts a page of a PDF to two JPEGs (one large and one normal), and
    uploads both to S3.

    Arguments:
    local_pdf_path -- path to local PDF
    page_number -- page number to convert
    local_jpeg_path -- path to save local normal JPEG file
    local_large_jpeg_path -- path to save local large JPEG file

    bucket -- the S3 bucket to upload to
    jpeg_prefix -- normal file in S3 will be named "[jpeg_prefix][page_number].jpeg",
      large file in S3 will be named "[jpeg_prefix][page_number]-large.jpeg"
    """
    subprocess.check_call(['convert', '-density', '300', '%s[%d]' %
      (local_pdf_path, page_number), local_large_jpeg_path])
    subprocess.check_call(['convert', '-resize', '800x800', '%s' %
      local_large_jpeg_path, local_jpeg_path])
    self._log('Finished converting page %d' % page_number)

    # store converted pages in S3
    large_jpeg_key = s3.Key(bucket)
    jpeg_key = s3.Key(bucket)

    # ImageMagick requires 0-indexed page numbers; we use 1-indexed page
    # numbers elsewhere
    large_jpeg_key.key = '%s%d-large.jpeg' % (jpeg_prefix, page_number + 1)
    jpeg_key.key = '%s%d.jpeg' % (jpeg_prefix, page_number + 1)

    large_jpeg_key.set_contents_from_filename(local_large_jpeg_path)
    jpeg_key.set_contents_from_filename(local_jpeg_path)

    large_jpeg_key.set_acl('public-read')
    jpeg_key.set_acl('public-read')

    self._log('Uploaded page %d' % page_number)

    local_jpeg = Image.open(local_jpeg_path)
    # Subtract 255 so pixels that are white (255, 255, 255) have 0 norm whereas
    # pixels close to black have a high norm
    distance_from_white = np.asarray(local_jpeg) - 255
    norm = np.linalg.norm(distance_from_white / float(local_jpeg.size[0] * local_jpeg.size[1]))
    if norm < self.BLANK_PAGE_THRESHOLD:
      # Return blank page information back to Scoryst. Communication via https

      requests.post(webhook_url, data={
        'blank_pages': page_number,
        # TODO: This won't work. We dont use exam_answer_ids
        'exam_answer_id': exam_answer_id,
        'webhook_secret': webhook_secret
      })
      self._log('Detected page number %d as blank' % page_number)
