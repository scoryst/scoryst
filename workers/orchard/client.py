import requests
from . import docker_client

class OrchardClient(object):
  """ Provides an interface to orchard. """
  HOSTS_API_URL = 'https://orchardup.com/api/v2/hosts'

  def __init__(self, api_key):
    """ Initializes this orchard client with an API key. """
    self.api_key = api_key
    self.auth_header = {'Authorization': 'Token %s' % api_key}


  def get_hosts(self):
    """ Returns a list of orchard hosts. """
    response = requests.get(OrchardClient.HOSTS_API_URL, headers=self.auth_header)
    raw_hosts = response.json()
    return map(lambda raw_host: OrchardHost(raw_host), raw_hosts)


  def get_host(self, name):
    """ Returns the orchard host with the given name. """
    url = '%s/%s' % (OrchardClient.HOSTS_API_URL, name)
    response = requests.get(url, headers=self.auth_header)

    if response.status_code == 200:
      return OrchardHost(response.json())
    else:
      return None


  def create_host(self, name, size):
    """ Creates a new orchard host. """
    data = {'name': name, 'size': size}
    response = requests.post(OrchardClient.HOSTS_API_URL, headers=self.auth_header,
      data=data)

    if response.status_code == 201:
      return OrchardHost(response.json())
    else:
      return None


  def remove_host(self, host):
    """ Remove the given orchard host. """
    url = '%s/%s' % (OrchardClient.HOSTS_API_URL, host.name)
    response = requests.delete(url, headers=self.auth_header)
    return response.status_code == 204


class OrchardHost(object):
  """ Represents an Orchard host. """
  def __init__(self, raw_host):
    """ Keeps track of the given host properties. """
    self.raw_host = raw_host


  def __getattr__(self, attr):
    """ Allows getting host properties as attributes. """
    return self.raw_host[attr]


  def get_docker_client(self):
    """ Returns a docker client for this host. """
    url = 'https://%s:4243' % self.ipv4_address
    docker = docker_client.OrchardDockerClient(base_url=url, version='1.8',
      timeout=10)

    docker.set_client_cert(self.client_cert, self.client_key)
    return docker
