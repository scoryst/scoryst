import sys
import argparse
import json

class IronWorker(object):
  def __init__(self):
    """ Initializes this IronWorker by reading arguments from ARGV. """
    self._read_args()

  def work(self):
    """ Does work. Should be overridden by subclass. """
    pass

  def _read_args(self):
    """ Reads the arguments from ARGV. """
    parser = argparse.ArgumentParser()
    parser.add_argument('-payload', '--payload', required=True)
    parser.add_argument('-d', '--directory', required=True)
    parser.add_argument('-id', '--id', required=True)

    args = parser.parse_args()
    with open(args.payload) as handle:
      contents = handle.read()

    self.payload = json.loads(contents)
    self.directory = args.directory
    self.id = args.id
