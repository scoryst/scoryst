import gnupg
import boto
from boto.s3 import connection as s3
from django.conf import settings

class Safe(object):
  def __init__(self, key):
    """ Creates a Safe that contains locked documents. """
    # set up GPG and S3 interfaces
    self.gpg = gnupg.GPG(use_agent=True)
    connection = s3.S3Connection(settings.AWS_S3_ACCESS_KEY_ID,
      settings.AWS_S3_SECRET_ACCESS_KEY)
    self.bucket = connection.get_bucket(settings.AWS_SAFE_BUCKET_NAME)


  def store(self, document_name, document_text):
    """ Encrypts the given text and stores it in a document with the provided name. """
    # encrypt text
    document_text = document_text.strip()
    encrypted_text = self.gpg.encrypt(document_text, settings.GPG_KEY_EMAIL)

    # store in S3
    key = s3.Key(self.bucket)
    key.key = '%s/%s' % (settings.GPG_KEY_EMAIL, document_name)
    key.set_contents_from_string(str(encrypted_text))


  def read(self, document_name):
    """ Decrypts and reads the given document. """
    # fetch encrypted text from S3 and decrypt
    key = s3.Key(self.bucket)
    key.key = '%s/%s' % (settings.GPG_KEY_EMAIL, document_name)

    try:
      encrypted_text = key.get_contents_as_string()
    except boto.exception.S3ResponseError:
      return None
    else:
      return self.gpg.decrypt(encrypted_text)


  def list(self):
    """ Lists all locked documents. """
    # find all files in the encrypted directory
    keys = self.bucket.list('%s/' % settings.GPG_KEY_EMAIL)
    document_names = map(lambda key: key.name, keys)

    # don't show directory in listing
    document_names = map(lambda name: name.replace('%s/' % settings.GPG_KEY_EMAIL, ''),
      document_names)
    return document_names


  def delete(self, document_name):
    """ Deletes the given locked document. """
    key = s3.Key(self.bucket)
    key.key = '%s/%s' % (settings.GPG_KEY_EMAIL, document_name)

    try:
      key.delete()
    except boto.exception.S3ResponseError:
      return False
    else:
      return True
