from converter import Converter
from flask import Flask, request
from Crypto.Cipher import AES
from Crypto import Random
import base64
import json

app = Flask(__name__)
CONVERTER_AES_KEY = 'iudoPuodaem5eeFiejot8eice3daekie'
CONVERTER_AES_INIT_VECTOR = 'eejanguK0yaa4gie'

@app.route('/ping', methods=['GET'])
def ping():
  return 'pong', 200, {'Content-Type': 'text/plain'}

@app.route('/work', methods=['POST'])
def work():
  """ Runs the converter with the provided POST arguments as payload. """
  data = request.get_json()

  # ensure payload exists
  encrypted_payload = data.get('encrypted_payload', None)
  if encrypted_payload == None:
    return 'No payload found', 403

  cipher = AES.new(CONVERTER_AES_KEY, AES.MODE_CFB, CONVERTER_AES_INIT_VECTOR)

  # run AES decryption and JSON deserialization
  try:
    payload = json.loads(cipher.decrypt(base64.b64decode(encrypted_payload)))
  except (ValueError, TypeError):
    return 'Bad payload', 403

  converter = Converter('/tmp')
  converter.work(payload)

  log = converter.get_log()
  status = 200 if converter.exited_cleanly else 500
  headers = {'Content-Type': 'text/plain'}

  return log, status, headers

if __name__ == '__main__':
  app.debug = True
  app.run(host='0.0.0.0')
