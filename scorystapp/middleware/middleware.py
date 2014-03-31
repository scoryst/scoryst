from django.http import QueryDict
import json
import re


class ChangeToCamelCaseMiddleware(object):
  """ Manages conversion to camelCase. """
  def process_response(self, request, response):
    """
    Goes through each key in the response content body and converts it to
    lowerCamelCase
    """
    content_type = response.get('Content-Type', '').split(';')[0]
    if 'json' in content_type:
      content = json.loads(response.content)
      content = self._change_keys(content, self._convert_underscore_to_lower_camelcase)
      response.content = json.dumps(content)
    return response


  def _change_keys(self, content, fn):
    """
    Recursively iterates over the keys in content and applies fn to each key so
    that the old keys are replaced by fn(key)
    eg. If fn changes a string to CAPS, then all the keys will be capitalized
    """
    if isinstance(content, list):
      for i in range(len(content)):
        content[i] = self._change_keys(content[i], fn)
    elif isinstance(content, dict):
      new_content = {}
      for key in content:
        new_key = fn(key)
        new_content[new_key] = self._change_keys(content[key], fn)
      return new_content
    return content


  def _convert_underscore_to_lower_camelcase(self, word):
    """ Converts under_score_name to underScoreName """
    camel_case = ''.join(x.capitalize() for x in word.split('_'))
    return camel_case[0].lower() + camel_case[1:] if len(camel_case) > 0 else ''
