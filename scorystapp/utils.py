import random
import string
from django.utils import timezone


def generate_random_string(length):
  """ Generates a random string with the given length """
  possible_chars = string.ascii_letters + string.digits
  char_list = [random.choice(possible_chars) for i in range(length)]
  return ''.join(char_list)


def generate_timestamped_random_name(prefix, suffix):
  """ Generates a string of the form `prefix`/<random_string><timestamp>.`suffix` """
  name = generate_random_string(40)
  return '%s/%s%s.%s' % (
    prefix, name, timezone.now().strftime("%Y%m%d%H%M%S"), suffix
  )
