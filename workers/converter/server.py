from converter import Converter
from flask import Flask, request
from Crypto.Cipher import AES
from Crypto import Random
from Crypto.Hash import HMAC, SHA256
import base64
import json

app = Flask(__name__)
CONVERTER_AES_KEY = 'iudoPuodaem5eeFiejot8eice3daekie'
CONVERTER_HMAC_KEY = 'raej6eo5ietoh1so0aeki5IeMaengees6ugh4eeghooshieQu3'

@app.route('/ping', methods=['GET'])
def ping():
  return 'pong', 200, {'Content-Type': 'text/plain'}

@app.route('/work', methods=['POST'])
def work():
  """ Runs the converter with the provided POST arguments as payload. """
  # HMAC is in hex, so every byte is encoded as two hex characters
  hmac_length = SHA256.digest_size * 2
  body = request.data[:-hmac_length]
  body_hmac = request.data[-hmac_length:]

  hmac = HMAC.new(CONVERTER_HMAC_KEY, msg=body, digestmod=SHA256)
  actual_body_hmac = hmac.hexdigest()

  # ensure integrity by checking HMAC
  if not body_hmac == actual_body_hmac:
    return 'Invalid HMAC', 403

  try:
    body = base64.b64decode(body)
  except (ValueError, TypeError):
    return 'Invalid body', 403

  iv_length = AES.block_size
  encrypted_payload = body[:-iv_length]

  # extract initialization vector for AES decryption
  iv = body[-iv_length:]
  cipher = AES.new(CONVERTER_AES_KEY, AES.MODE_CFB, iv)

  # run AES decryption and JSON deserialization
  try:
    payload = json.loads(cipher.decrypt(encrypted_payload))
  except (ValueError, TypeError):
    return 'Invalid payload', 403

  converter = Converter('/tmp')
  converter.work(payload)

  # TODO: stream log data down
  log = converter.get_log()
  status = 200 if converter.exited_cleanly else 500
  headers = {'Content-Type': 'text/plain'}

  return log, status, headers

if __name__ == '__main__':
  app.debug = True
  app.run(host='0.0.0.0')
