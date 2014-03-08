import os
import json
import requests
import subprocess
import time
import base64
from scorystapp import utils
from django.conf import settings
from Crypto.Cipher import AES
from Crypto import Random


def dispatch_worker(worker_name, orchard, host, payload):
  """
  Dispatches a worker with the given name to the provided orchard host.
  Delivers the provided payload as arguments to the worker.
  """
  if host == None:
    print 'Invalid host'
    return

  worker_dir = os.path.abspath(os.path.dirname(__file__))

  try:
    print 'Running docker build...'
    docker = host.get_docker_client()
    for line in docker.build('%s/%s' % (worker_dir, worker_name), stream=True):
      print 'docker build: %s' % line,

    print 'Creating docker container...'
    image = docker.images()[0]
    container = docker.create_container(image['Id'], ports=[5000])
    docker.start(container['Id'], port_bindings={5000: 5000})

    print "Waiting for container's HTTP server to start..."
    host_ip = host.ipv4_address
    host_url = 'http://%s:5000' % host_ip

    # periodically try to connect to container
    while True:
      try:
        requests.get('%s/ping' % host_url, timeout=5)
      except (requests.Timeout, requests.ConnectionError):
        print "Couldn't connect, trying again..."
        time.sleep(1)
      else:
        print 'Successfully connected!'
        break

    print 'Making POST request to activate worker...'
    # encrypt payload
    cipher = AES.new(settings.CONVERTER_AES_KEY, AES.MODE_CFB,
      settings.CONVERTER_AES_INIT_VECTOR)
    encrypted_payload = cipher.encrypt(json.dumps(payload))

    # make POST request to worker with payload
    data = {'encrypted_payload': base64.b64encode(encrypted_payload)}
    headers = {'Content-type': 'application/json'}

    response = requests.post('%s/work' % host_url, data=json.dumps(data),
      headers=headers)

    print response.text
    print 'Removing container...'
    try:
      docker.stop(container['Id'])

    # docker.stop() often times out, but still succeeds, so ignore timeouts and proceed
    except requests.Timeout:
      docker.remove_container(container['Id'])

  finally:
    print 'Removing orchard host...'
    orchard.remove_host(host)
