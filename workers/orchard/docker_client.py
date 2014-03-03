import tempfile
import docker

class OrchardDockerClient(docker.Client):
  """ Provides an interface to docker on orchard. """
  def set_client_cert(self, cert, key):
    """ Sets the client certificate for requests. """
    # must create a file containing the certificate for use with the requests lib
    self.cert_handle = tempfile.NamedTemporaryFile()
    self.cert_handle.write(cert)
    self.cert_handle.flush()

    self.key_handle = tempfile.NamedTemporaryFile()
    self.key_handle.write(key)
    self.key_handle.flush()

    self.cert_path = (self.cert_handle.name, self.key_handle.name)


  def _post(self, url, **kwargs):
    """ Makes a POST request to the given URL. """
    self._set_request_client_cert(kwargs)
    return self.post(url, **self._set_request_timeout(kwargs))


  def _get(self, url, **kwargs):
    """ Makes a GET request to the given URL. """
    self._set_request_client_cert(kwargs)
    return self.get(url, **self._set_request_timeout(kwargs))


  def _delete(self, url, **kwargs):
    """ Makes a DELETE request to the given URL. """
    self._set_request_client_cert(kwargs)
    return self.delete(url, **self._set_request_timeout(kwargs))


  def _set_request_client_cert(self, kwargs):
    """ Sets client certificate parameters in the given dictionary. """
    kwargs['verify'] = False
    kwargs['cert'] = self.cert_path
