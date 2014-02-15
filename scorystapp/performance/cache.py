import cacheops
from cacheops import conf
import functools
import pickle

def cache_across_querysets(sets):
  """
  Generates a decorator that caches a function until any one of the given querysets
  are invalidated. Any queryset that you can pass to @cacheops.cached_as() works here.
  """
  def decorator(func):
    key = 'cache_across_querysets:%s.%s' % (func.__module__, func.__name__)

    @functools.wraps(func)
    def wrapper(*args):
      cache_data = conf.redis_client.get(key)
      sets_cached = _are_sets_all_cached(sets)

      # if the cache hit for all sets, and we have a cached result, return it
      if sets_cached and not cache_data == None:
        return pickle.loads(cache_data)

      # cache didn't hit; run the function and cache the result
      result = func(*args)
      conf.redis_client.set(key, pickle.dumps(result))

      return result
    return wrapper
  return decorator


def _are_sets_all_cached(sets, timeout=None):
  """
  Returns True if all the given querysets are cached, or False otherwise.
  Any queryset that you can pass to @cacheops.cached_as() works here.
  """
  cache_miss = False

  for queryset in sets:
    @cacheops.cached_as(queryset, timeout=timeout)
    def _detect_miss():
      _detect_miss.missed = True

    _detect_miss.missed = False
    _detect_miss()

    # if _detect_miss is actually called, it'll set _detect_miss.missed to True;
    # this is how we know if the current queryset is cached
    cache_miss = cache_miss or _detect_miss.missed

    # Note: do NOT break from this for loop early if cache_miss is True; we need
    # to go through each queryset and cache it if it isn't already cached

  return not cache_miss
