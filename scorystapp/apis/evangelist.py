from django.conf import settings
import requests
import os

def convert_pdf_to_jpegs(s3_pdf_path, s3_jpeg_path, s3_small_jpeg_path,
    s3_large_jpeg_path):
  """
  Converts the PDF in S3 at `s3_pdf_path` to JPEGs by making a request to
  Evangelist. Evangelist produces three JPEGs for each page: one normal, one
  small, and one large. The normal PDF is uploaded to `s3_jpeg_path`, the small
  PDF is uploaded to `s3_small_jpeg_path`, and the large PDF is uploaded to
  `s3_large_jpeg_path`. `s3_jpeg_path`, `s3_small_jpeg_path`, and
  `s3_large_jpeg_path` should all have a %d in them that will be replaced by
  the JPEG's corresponding page number. Returns the response text from
  Evangelist.
  """
  request_params = {
    's3PDFPath': s3_pdf_path,
    's3JPEGPath': s3_jpeg_path,
    's3SmallJPEGPath': s3_small_jpeg_path,
    's3LargeJPEGPath': s3_large_jpeg_path,
  }

  server_cert = os.path.abspath(os.path.dirname(__file__) +
    '/evangelist-server.crt')
  client_cert = os.path.abspath(os.path.dirname(__file__) +
    '/evangelist-client.crt')
  client_key = os.path.abspath(os.path.dirname(__file__) +
    '/evangelist-client.key')

  response = requests.post(settings.EVANGELIST_URL, data=request_params,
    verify=server_cert, cert=(client_cert, client_key))

  # raise error if bad status code
  response.raise_for_status()
  return response.text
