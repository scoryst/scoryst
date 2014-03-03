from boto.s3 import connection as s3
import subprocess
import PyPDF2
import threading
import worker

class Converter(worker.Worker):
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
    self._log('Connecting to s3')
    connection, bucket = self._connect_to_s3(payload['s3'])

    # convert each PDF in a separate thread
    for index, pdf_path in enumerate(payload['pdf_paths']):
      self._convert_pdf(bucket, pdf_path, jpeg_prefixes[index])


  def _connect_to_s3(self, credentials):
    """
    Connects to S3 with the given credentials. Returns a tuple of Boto
    (connection, bucket) objects.
    """
    connection = s3.S3Connection(credentials['token'], credentials['secret'])
    bucket = connection.get_bucket(credentials['bucket'])
    return connection, bucket


  def _convert_pdf(self, bucket, pdf_path, jpeg_prefix):
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
      local_jpeg_path = '%s/%s%d.jpeg' % (self.working_dir, local_jpeg_prefix,
        page_number + 1)

      # single-threaded:
      # self._upload_page(local_pdf_path, page_number, local_jpeg_path, bucket, jpeg_prefix)

      # multi-threaded:
      threads.append(threading.Thread(target=self._upload_page, args=(local_pdf_path,
        page_number, local_jpeg_path, bucket, jpeg_prefix)))

    [thread.start() for thread in threads]

    # wait until all threads have complete
    [thread.join() for thread in threads]


  def _upload_page(self, local_pdf_path, page_number, local_jpeg_path, bucket,
      jpeg_prefix):
    """
    Converts a page of a PDF to a JPEG and uploads it to S3.

    Arguments:
    local_pdf_path -- path to local PDF
    page_number -- page number to convert
    local_jpeg_path -- path to save local JPEG file

    bucket -- the S3 bucket to upload to
    jpeg_prefix -- file in S3 will be named "[jpeg_prefix][page_number].jpeg"
    """
    # ImageMagick requires 0-indexed page numbers; we use 1-indexed page
    # numbers elsewhere
    subprocess.check_call(['convert', '-density', '300', '%s[%d]'
      % (local_pdf_path, page_number), local_jpeg_path])
    self._log('Finished converting page %d' % page_number)

    # store converted page in S3
    jpeg_key = s3.Key(bucket)
    jpeg_key.key = '%s%d.jpeg' % (jpeg_prefix, page_number + 1)

    jpeg_key.set_contents_from_filename(local_jpeg_path)
    jpeg_key.set_acl('public-read')
    self._log('Uploaded page %d' % page_number)


if __name__ == '__main__':
  converter = Converter()
  converter.work()
