from scorystapp import models
from bootstrap3_datetime import widgets as datetime_widgets
from django import forms
from django.contrib.auth import authenticate, forms as django_forms
from django.contrib.admin import widgets
from django.utils import html
import PyPDF2


class HorizontalRadioRenderer(forms.RadioSelect.renderer):
  """
  Overrides the renderer method so that radio buttons are rendered horizontal as
  opposed to as a vertical list, making it compatible with Bootstrap styling.
  """
  def render(self):
    # Add inline-radio class to input fields
    modified_radio_buttons = []
    for radio_button in self:
      radio_button_str = str(radio_button)
      modified_radio_button = '%s class="radio-inline" %s' % (radio_button_str[:6],
        radio_button_str[6:])
      modified_radio_buttons.append(modified_radio_button)
    full_html = u'\n'.join([u'%s\n' % radio_button for radio_button in modified_radio_buttons])
    return html.mark_safe(full_html)


# TODO: Currently not in use.
# Will be needed once we allow anyone to create an account
class UserSignupForm(forms.Form):
  """ Allow a student to sign up. """
  username = forms.CharField(max_length=100)
  password = forms.CharField(max_length=100)
  college_student_id = forms.IntegerField()
  college_username = forms.CharField(max_length=100)


class UserLoginForm(forms.Form):
  """ Allows the user to log in. """
  email = forms.EmailField(max_length=100)
  password = forms.CharField(max_length=100, widget=forms.PasswordInput)

  def clean_email(self):
    """ Converts email to lowercase. """
    return self.cleaned_data['email'].lower()

  def clean(self):
    """ Confirms the user provided valid credentials. """
    data = self.cleaned_data
    email = data.get('email')
    password = data.get('password')

    user = authenticate(username=email, password=password)
    if email and password:
      if user is None:
        raise forms.ValidationError('Invalid credentials.')
      elif not user.is_active:
        raise forms.ValidationError('User is not active.')
      elif not user.is_signed_up:
        user.is_signed_up = True
        user.save()
    return data


class AddPeopleForm(forms.Form):
  """ Allows the user to add students/TAs to a class. """
  people = forms.CharField(max_length=40000, widget=forms.Textarea)
  privilege = forms.ChoiceField(choices=models.CourseUser.USER_PRIVILEGE_CHOICES,
    widget=forms.RadioSelect)

  def clean_people(self):
    """
    Ensures people field is a valid listing of people. Each person should have
    a first name, last name, email, and student ID.
    """
    people = self.cleaned_data.get('people')
    cleaned_people = []

    if not people:
      return people

    for person in people.splitlines():
      parts = person.split(',')

      # ensure we have all parts
      if not len(parts) == 4:
        raise forms.ValidationError('You must provide a first name, last name, '
          'email, and ID for each student')

      parts = map(lambda part: part.strip(), parts)
      first_name, last_name, email, student_id = parts

      # ensure email is valid
      field = forms.EmailField(max_length=100, error_messages={
        'invalid': '%s is not a valid email address' % email})
      email = field.clean(email)

      # ensure first name, last name, and student ID are provided
      field = forms.CharField(max_length=100)
      first_name = field.clean(first_name)
      last_name = field.clean(last_name)
      student_id = field.clean(student_id)

      # reconstruct cleaned string
      cleaned_people.append(','.join((first_name, last_name, email, student_id)))

    return '\n'.join(cleaned_people)


class AssessmentUploadForm(forms.Form):
  """ Allows an exam to be uploaded along with the empty and solutions pdf file """
  MAX_ALLOWABLE_PDF_SIZE = 1024 * 1024 * 20

  HOMEWORK_TYPE = 'homework'
  EXAM_TYPE = 'exam'
  ASSESSMENT_TYPES = (
      (HOMEWORK_TYPE, 'Homework'),
      (EXAM_TYPE, 'Exam'),
  )

  GRADE_DOWN_TYPE = 'down'
  GRADE_UP_TYPE = 'up'
  GRADE_TYPES = (
      (GRADE_DOWN_TYPE, 'Grade down'),
      (GRADE_UP_TYPE, 'Grade up'),
  )

  assessment_type = forms.ChoiceField(choices=ASSESSMENT_TYPES,
    widget=forms.RadioSelect(renderer=HorizontalRadioRenderer), initial=HOMEWORK_TYPE)
  name = forms.CharField(max_length=40)
  grade_type = forms.ChoiceField(choices=GRADE_TYPES,
    widget=forms.RadioSelect(renderer=HorizontalRadioRenderer), initial=GRADE_DOWN_TYPE)

  exam_file = forms.FileField(required=False)
  solutions_file = forms.FileField(required=False)

  submission_deadline = forms.DateTimeField(required=False, widget=datetime_widgets.DateTimePicker(options=False))

  question_part_points = forms.CharField()

  def clean(self):
    assessment_type = self.cleaned_data.get('assessment_type')
    print assessment_type
    if assessment_type == self.HOMEWORK_TYPE and not self.cleaned_data.get('submission_deadline'):
      # homework submission time required; add error to respective field
      self._errors['submission_deadline'] = self.error_class(['Must provide valid submission deadline.'])
      # This field is not valid, so remove from the cleaned_data
      del self.cleaned_data['submission_deadline']

    return self.cleaned_data


  def clean_exam_file(self):
    """
    Ensure that the exam_file is less than MAX_ALLOWABLE_PDF_SIZE and is a valid pdf.
    """
    exam_file = self.cleaned_data.get('exam_file')
    if exam_file:
      _validate_pdf_file(exam_file, AssessmentUploadForm.MAX_ALLOWABLE_PDF_SIZE)
    return exam_file


  def clean_solutions_file(self):
    """
    Ensure that the solutions_file is less than MAX_ALLOWABLE_PDF_SIZE and
    is a valid pdf
    """
    solutions_file = self.cleaned_data['solutions_file']
    if solutions_file:
      _validate_pdf_file(solutions_file, AssessmentUploadForm.MAX_ALLOWABLE_PDF_SIZE)
    return solutions_file


class StudentExamsUploadForm(forms.Form):
  """ Allows student exams to be uploaded """

  def __init__(self, *args, **kwargs):
    """ We pass in exam_choices from upload.py and retrieve the argument here  """
    exam_choices = kwargs.pop('exam_choices')
    super(StudentExamsUploadForm, self).__init__(*args, **kwargs)
    self.fields['exam_name'].choices = exam_choices

  # 100MB
  # TODO: Decide our max size. 100MB seems plausible if the pdf had 40 students
  # but it also might be too large for us to handle when we expand.
  MAX_ALLOWABLE_PDF_SIZE = 1024 * 1024 * 100

  exam_name = forms.ChoiceField()
  exam_file = forms.FileField()

  def clean_exam_file(self):
    """
    Ensure that the exam_file is less than MAX_ALLOWABLE_PDF_SIZE and is a valid
    pdf
    """
    exam_file = self.cleaned_data.get('exam_file')
    if exam_file:
      _validate_pdf_file(exam_file, StudentExamsUploadForm.MAX_ALLOWABLE_PDF_SIZE)
    return exam_file


def _validate_pdf_file(pdf_file, max_size):
  """ Validates the pdf_file and ensures it is less than max_size (which is in bytes). """
  if pdf_file.size > max_size:
    max_size_in_mb = max_size / float(1024 * 1024)
    user_size_in_mb = pdf_file.size / float(1024 * 1024)
    raise forms.ValidationError('Max size allowed is %d MB but file size is %d MB' %
      (max_size_in_mb, user_size_in_mb))

  if 'pdf' not in pdf_file.content_type and 'octet-stream' not in pdf_file.content_type:
    raise forms.ValidationError('Only PDF files are acceptable')
  try:
    PyPDF2.PdfFileReader(pdf_file)
  except:
    raise forms.ValidationError('The PDF file is invalid and may be corrupted')
  pdf_file.seek(0)  # Undo work of PdfFileReader


class CourseForm(forms.ModelForm):
  """ Model Form for creating a new course """
  class Meta:
    model = models.Course


class QuestionPartForm(forms.ModelForm):
  """ Model Form for creating a new question part used by create-exam """
  class Meta:
    model = models.QuestionPart
    exclude = ('assessment',)


class RubricForm(forms.ModelForm):
  """ Model Form for creating a new rubric used by create-exam """
  class Meta:
    model = models.Rubric
    exclude = ('question_part',)


class SetPasswordWithMinLengthForm(django_forms.SetPasswordForm):
  """ Form for resetting password. Ensure that the password length is at least 8. """
  def clean_new_password1(self):
    password1 = self.cleaned_data.get('new_password1')
    return _validate_password_length(password1)


class PasswordWithMinLengthChangeForm(django_forms.PasswordChangeForm):
  """ Form for changing password. Ensure that the password length is at least 8. """
  def clean_new_password1(self):
    password1 = self.cleaned_data.get('new_password1')
    return _validate_password_length(password1)


def _validate_password_length(password):
    if len(password) < 8:
      raise forms.ValidationError('Password must be at least 8 characters.')
    return password

