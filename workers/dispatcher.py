import time
import os
import base64
import json
import requests
from fabric import api
from fabric import exceptions
from boto import ec2
from django.conf import settings
from Crypto.Cipher import AES
from Crypto import Random
from Crypto.Hash import HMAC, SHA256

DIRECTORY = os.path.abspath(os.path.dirname(__file__))


class Dispatcher(object):
  """ Dispatches jobs on AWS instances. """

  DEFAULT_INSTANCE_OPTIONS = {
    'instance_type': 't1.micro',
    'image': 'ami-9c91acd9',
    'key_name': 'scoryst',
    'security_groups': ['basic'],
  }

  DEFAULT_SSH_OPTIONS = {
    'user': 'ubuntu',
    'key_path': DIRECTORY + '/scoryst.pem',
  }


  def __init__(self, region='us-west-1'):
    """ Initializes this dispatcher by connecting to AWS. """
    # TODO: rename access key (shouldn't have s3 in it)
    self.connection = ec2.connect_to_region(region,
      aws_access_key_id=settings.AWS_S3_ACCESS_KEY_ID,
      aws_secret_access_key=settings.AWS_S3_SECRET_ACCESS_KEY)


  def run(self, worker_name, payload, instance_options={}, ssh_options={}):
    """
    Spawns an instance, provisions it for the given worker, and dispatches
    a job with the provided payload. Returns the response from the worker.
    """
    response = None
    instance = self.spawn(instance_options)

    try:
      self.provision(instance, worker_name, ssh_options)
      response = self.dispatch(instance, payload)
    finally:
      # always terminate the instance, regardless of whether an error occurred
      # self.terminate(instance)
      pass

    return response


  def spawn(self, instance_options={}):
    """
    Spawns an instance to run the given worker. `instance_options` is
    a dictionary of options for the instance. See `DEFAULT_INSTANCE_OPTIONS`
    above. Waits until the instance is running. Returns the instance.
    """
    instance_options = dict(self.DEFAULT_INSTANCE_OPTIONS.items() +
      instance_options.items())

    instance = self._create_instance(instance_options)
    self._wait_until_instance_is_running(instance)

    return instance


  def provision(self, instance, worker_name, ssh_options={}):
    """
    Provisions a worker on the given instance. `ssh_options` is a dictionary of
    options for sshing. See `DEFAULT_SSH_OPTIONS` above.
    """
    ssh_options = dict(self.DEFAULT_SSH_OPTIONS.items() +
      ssh_options.items())

    with self._create_fab_env(instance.ip_address, ssh_options):
      self._wait_until_instance_is_ssh_able()
      self._upload_and_provision_worker(worker_name)


  def dispatch(self, instance, payload):
    """
    Dispatches the worker running on the provided instance. Passes the given
    payload to the worker as arguments. Returns the response from the worker.
    """
    # generate random initialization vector for each request
    iv = Random.new().read(AES.block_size)
    cipher = AES.new(settings.CONVERTER_AES_KEY, AES.MODE_CFB, iv)

    # encrypt data with AES for confidentiality
    encrypted_payload = cipher.encrypt(json.dumps(payload))
    body = base64.b64encode(encrypted_payload + iv)

    # add HMAC for integrity
    hmac = HMAC.new(settings.CONVERTER_HMAC_KEY, msg=body, digestmod=SHA256)
    body_hmac = hmac.hexdigest()

    return requests.post('http://%s:5000/work' % instance.ip_address,
      data=body + body_hmac)


  def terminate(self, instance):
    """ Terminates the given instance. """
    self.connection.terminate_instances(instance_ids=[instance.id])


  def _create_instance(self, options):
    """
    Creates an instances based off the given options. See
    `DEFAULT_INSTANCE_OPTIONS` for a list of options.
    """
    reservation = self.connection.run_instances(options['image'],
      key_name=options['key_name'], instance_type=options['instance_type'],
      security_groups=options['security_groups'])

    return reservation.instances[0]


  def _wait_until_instance_is_running(self, instance):
    """ Waits until the given instance is running. """
    while not instance.state == 'running':
      instance.update()
      time.sleep(1)


  def _create_fab_env(self, instance_ip, ssh_options):
    """
    Creates and returns a fab environment to SSH into the given instance. Pass
    this to with() to use fabric.api.* commands.
    """
    return api.settings(host_string=instance_ip,
      user=ssh_options['user'],
      key_filename=ssh_options['key_path'])


  def _wait_until_instance_is_ssh_able(self):
    """
    Waits until the given instance is ssh-able. Must be in the fab environment.
    """
    while True:
      try:
        api.run('ls')
      except exceptions.NetworkError:
        time.sleep(3)
      else:
        break


  def _upload_and_provision_worker(self, worker_name):
    """ Uploads and runs the given worker. """
    # if there's an existing worker, delete it
    api.run('rm -rf worker')

    api.run('mkdir worker')
    api.put('%s/%s/*' % (DIRECTORY, worker_name), 'worker/')

    with api.cd('worker'):
      # this will spawn a background process; run with pty=False to circumvent
      # fabric issue 395 <https://github.com/fabric/fabric/issues/395>
      api.run('bash provision.sh', pty=False)
