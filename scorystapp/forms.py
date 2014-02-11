from scorystapp import models
from django import forms
from django.contrib.auth import authenticate
import PyPDF2


# TODO: Currently not in use
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


class ExamUploadForm(forms.Form):
  """ Allows an exam to be uploaded along with the empty and solutions pdf file """
  MAX_ALLOWABLE_PDF_SIZE = 1024 * 1024 * 20
  exam_name = forms.CharField(max_length=100)
  exam_file = forms.FileField()
  exam_solutions_file = forms.FileField(required=False)

  def clean_exam_file(self):
    """
    Ensure that the exam_file is less than MAX_ALLOWABLE_PDF_SIZE and is a valid
    pdf 
    """
    data = self.cleaned_data.get('exam_file')
    if data:
      if data.size > ExamUploadForm.MAX_ALLOWABLE_PDF_SIZE:
        max_size_in_mb = ExamUploadForm.MAX_ALLOWABLE_PDF_SIZE / float(1024 * 1024)
        user_size_in_mb = data.size / float(1024 * 1024)
        raise forms.ValidationError('Max size allowed is %d MB but file size is %d MB' %
          (max_size_in_mb, user_size_in_mb))
      
      if 'pdf' not in data.content_type and 'octet-stream' not in data.content_type:
        raise forms.ValidationError('Only PDF files are acceptable')
      try:
        PyPDF2.PdfFileReader(data)
      except:
        raise forms.ValidationError('The PDF file is invalid and may be corrupted')
      data.seek(0, 0)  # Undo work of PdfFileReader
    return data

  # TODO: Decompose out common code between this and clean_exam_file
  def clean_exam_solutions_file(self):
    """
    Ensure that the exam_solutions_file is less than MAX_ALLOWABLE_PDF_SIZE and 
    is a valid pdf
    """
    data = self.cleaned_data['exam_solutions_file']
    if data:
      if data.size > ExamUploadForm.MAX_ALLOWABLE_PDF_SIZE:
        max_size_in_mb = ExamUploadForm.MAX_ALLOWABLE_PDF_SIZE / float(1024 * 1024)
        user_size_in_mb = data.size / float(1024 * 1024)
        raise forms.ValidationError('Max size allowed is %d MB but solution size is %d MB' %
          (max_size_in_mb, user_size_in_mb))
      
      if 'pdf' not in data.content_type and 'octet-stream' not in data.content_type:
        raise forms.ValidationError('Only PDF files are acceptable')
      try:
        PyPDF2.PdfFileReader(data)
      except:
        raise forms.ValidationError('The PDF file is invalid and may be corrupted')
      data.seek(0, 0)  # Undo work of PdfFileReader
    return data


class StudentExamsUploadForm(forms.Form):
  """ Allows an exam to be uploaded along with the empty and solutions pdf file """

  def __init__(self, *args, **kwargs):
    """ We pass in exam_choices from upload.py and retrieve the argument here  """
    exam_choices = kwargs.pop('exam_choices')
    super(StudentExamsUploadForm, self).__init__(*args, **kwargs)
    self.fields['exam_name'].choices = exam_choices

  # 100MB
  # TODO:Change back to 25?
  MAX_ALLOWABLE_PDF_SIZE = 1024 * 1024 * 100

  exam_name = forms.ChoiceField()
  exam_file = forms.FileField()

  def clean_exam_file(self):
    """
    Ensure that the exam_file is less than MAX_ALLOWABLE_PDF_SIZE and is a valid
    pdf 
    """
    data = self.cleaned_data.get('exam_file')
    if data:
      if data.size > ExamUploadForm.MAX_ALLOWABLE_PDF_SIZE:
        max_size_in_mb = ExamUploadForm.MAX_ALLOWABLE_PDF_SIZE / float(1024 * 1024)
        user_size_in_mb = data.size / float(1024 * 1024)
        raise forms.ValidationError('Max size allowed is %d MB but file size is %d MB' %
          (max_size_in_mb, user_size_in_mb))
      
      if 'pdf' not in data.content_type and 'octet-stream' not in data.content_type:
        raise forms.ValidationError('Only PDF files are acceptable')
      try:
        PyPDF2.PdfFileReader(data)
      except:
        raise forms.ValidationError('The PDF file is invalid and may be corrupted')
      data.seek(0, 0)  # Undo work of PdfFileReader
    return data


class CourseForm(forms.ModelForm):
  """ Model Form for creating a new course """
  class Meta:
    model = models.Course


class QuestionPartForm(forms.ModelForm):
  """ Model Form for creating a new question part used by create-exam """
  class Meta:
    model = models.QuestionPart
    exclude = ('exam',)


class RubricForm(forms.ModelForm):
  """ Model Form for creating a new rubric used by create-exam """
  class Meta:
    model = models.Rubric
    exclude = ('question_part',)
