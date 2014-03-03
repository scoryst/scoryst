import traceback

class Worker(object):
  def __init__(self, working_dir):
    """ Initializes this worker. Requires a working directory. """
    self.working_dir = working_dir
    self.log = []

  def work(self, payload):
    """ Does work, logging any error that occurs. """
    try:
      self._work(payload)
    except Exception as error:
      self._log(traceback.format_exc())
      self.exited_cleanly = False
    else:
      self._log('Finished successfully')
      self.exited_cleanly = True

  def get_log(self):
    """ Gets all log messages in a string. """
    return '\n'.join(self.log) + '\n'

  def _work(self, payload):
    """ Does work. Should be overridden by subclass. """
    pass

  def _log(self, message):
    """ Adds the given message to the log. Useful for debugging. """
    self.log.append(message)
