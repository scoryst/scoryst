from boto.s3 import connection as s3
import Queue
import worker
import subprocess
import PyPDF2
import threading

class Converter(worker.IronWorker):
  def work(self):
    """
    Using ImageMagick, converts the given PDFs to JPGs. PDFs are passed as paths
    in S3. They're read from S3, converted to JPGs, and stored back in S3.
    
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

    "jpg_prefixes": [
      # if prefix is 'pre', JPGs stored in S3 will be named 'pre1.jpg', 'pre2.jpg', etc.
      (string) prefix for JPG names for first PDF,
      (string) prefix for JPG names for second PDF,
      ...
    ]
    """
    jpg_prefixes = self.payload['jpg_prefixes']
    print 'connecting to s3'
    connection, bucket = self._connect_to_s3()

    # convert each PDF in a separate thread
    for index, pdf_path in enumerate(self.payload['pdf_paths']):
      self._convert_pdf(bucket, pdf_path, jpg_prefixes[index])


  def _connect_to_s3(self):
    """
    Connects to S3 with the credentials in the payload. Returns a tuple of
    Boto (connection, bucket) objects.
    """
    payload = self.payload
    connection = s3.S3Connection(payload['s3']['token'], payload['s3']['secret'])
    bucket = connection.get_bucket(payload['s3']['bucket'])
    return connection, bucket


  def _convert_pdf(self, bucket, pdf_path, jpg_prefix):
    """
    Converts the PDF in S3 given by pdf_path to JPGs. For each page in the PDF,
    stores a JPG by name "[jpg_prefix][pdf_page_number].jpg" in S3. bucket
    represents the Boto S3 bucket object.
    """
    # download PDF locally
    pdf_key = s3.Key(bucket)
    pdf_key.key = pdf_path

    local_jpg_prefix = jpg_prefix.replace('/', '-')
    local_pdf_path = '%s/%s.pdf' % (self.directory, local_jpg_prefix)
    pdf_key.get_contents_to_filename(local_pdf_path)

    # get number of pages
    with open(local_pdf_path, 'rb') as handle:
      pdf_reader = PyPDF2.PdfFileReader(handle)
      num_pages = pdf_reader.getNumPages()

    print 'get num pages %d' % num_pages
    threads = []

    # convert each page in a separate thread using ImageMagick
    for page_number in range(0, num_pages):
      local_jpg_path = '%s/%s%d.jpg' % (self.directory, local_jpg_prefix,
        page_number + 1)
      threads.append(threading.Thread(target=self._upload_page, args=(local_pdf_path,
        page_number, local_jpg_path, bucket, jpg_prefix)))

    [thread.start() for thread in threads]

    # wait until all threads have complete
    [thread.join() for thread in threads]


  def _upload_page(self, local_pdf_path, page_number, local_jpg_path, bucket,
      jpg_prefix):
    """
    Converts a page of a PDF to a JPG and uploads it to S3.

    Arguments:
    local_pdf_path -- path to local PDF
    page_number -- page number to convert
    local_jpg_path -- path to save local JPG file

    bucket -- the S3 bucket to upload to
    jpg_prefix -- file in S3 will be named "[jpg_prefix][page_number].jpg"
    """
    print 'uploading page %d' % page_number

    # ImageMagick requires 0-indexed page numbers; we use 1-indexed page
    # numbers elsewhere
    subprocess.check_call(['convert', '-density', '300', '%s[%d]'
      % (local_pdf_path, page_number), local_jpg_path])
    print 'finish conversion'

    # store converted page in S3
    jpg_key = s3.Key(bucket)
    jpg_key.key = '%s%d.jpg' % (jpg_prefix, page_number + 1)

    jpg_key.set_contents_from_filename(local_jpg_path)
    jpg_key.set_acl('public-read')
    print 'uploaded page %d' % page_number


print 'outside main if'
if __name__ == '__main__':
  print 'starting converter'
  converter = Converter()
  print 'doing work now...'
  converter.work()
