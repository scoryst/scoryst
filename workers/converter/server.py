from converter import Converter
from flask import Flask, request

app = Flask(__name__)

@app.route('/work', methods=['POST'])
def work():
  """ Runs the converter with the provided POST arguments as payload. """
  converter = Converter('/tmp')
  converter.work(request.get_json())

  log = converter.get_log()
  status = 200 if converter.exited_cleanly else 500
  headers = {'Content-Type': 'text/plain'}

  return log, status, headers

if __name__ == '__main__':
  # TODO: remove this debug
  app.debug = True
  app.run(host='0.0.0.0')
