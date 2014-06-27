from django import http
from django.core import mail
from django.contrib.sites.models import get_current_site
from scorystapp import decorators


@decorators.login_required
def feedback(request):
  """
  Gets feedback from the user and sends an email to hello@scoryst.com with details.
  """
  if request.method == 'POST':
    current_site = get_current_site(request)
    domain = current_site.domain

    subject = 'You have feedback!'
    from_email = 'Scoryst <hello@%s>' % domain
    to_email = 'Scoryst <hello@%s>' % domain
    reply_email = request.user.email
    body = '%s has feedback for you:\n%s' % (
      request.user.get_full_name(), request.POST['feedback']
    )

    headers = { 'Reply-To': reply_email }
    msg = mail.EmailMessage(subject, body, from_email, [to_email], headers=headers)
    msg.content_subtype = "html"
    msg.send()
    return http.HttpResponse(status=200)

  return http.Http404
