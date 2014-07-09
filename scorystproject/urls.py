from scorystapp import forms
from scorystapp.views import helpers
from django.core.urlresolvers import reverse_lazy
from django.conf import settings
from django.conf.urls import patterns, include, url
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
import debug_toolbar

# The next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
  url(r'^admin/jsi18n/', 'django.views.i18n.javascript_catalog'),
  url(r'^$', 'scorystapp.views.general.root'),
  url(r'^login/$', 'scorystapp.views.auth.login'),
  url(r'^login/redirect/(?P<redirect_path>.*?enroll/(?P<token>\w+)/)$', 'scorystapp.views.auth.login'),
  url(r'^login/redirect/(?P<redirect_path>.*?)$', 'scorystapp.views.auth.login'),
  url(r'^login/enroll/(?P<token>\w+)/$', 'scorystapp.views.auth.login'),
  url(r'^logout/$', 'scorystapp.views.auth.logout'),
  url(r'^new-course/$', 'scorystapp.views.course.new_course'),
  url(r'^about/$', 'scorystapp.views.general.about'),
  url(r'^welcome/$', 'scorystapp.views.general.welcome'),
  url(r'^feedback/$', 'scorystapp.views.feedback.feedback'),

  # sign-up
  url(r'^sign-up/$', 'scorystapp.views.auth.sign_up'),

  # enroll
  url(r'^enroll/(?P<token>\w+)/$', 'scorystapp.views.course.enroll'),

  # course roster
  # TODO: naming of views now that we have separate files; e.g. roster.delete
  # instead of roster.delete_from_roster
  url(r'^course/(?P<course_id>\d+)/roster/$', 'scorystapp.views.roster.roster'),
  url(r'^course/(?P<course_id>\d+)/roster/delete/(?P<course_user_id>\d+)/$',
    'scorystapp.views.roster.delete_from_roster'),
  url(r'^course/(?P<course_id>\d+)/roster/course-user/$',
      'scorystapp.views.roster.list_course_users'),
  url(r'^course/(?P<course_id>\d+)/roster/course-user/(?P<course_user_id>\d+)/$',
    'scorystapp.views.roster.manage_course_user'),


  # exam mapping
  # We maintain the course/<course_id>/assessments/<id>
  # However, <id> here is `exam_id` not `assessment_id` since instructors only
  # need to deal with assigning exams to students, homeworks aren't handled this way.
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<exam_id>\d+)/assign/$',
    'scorystapp.views.assign.assign'),
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<exam_id>\d+)/assign/(?P<submission_id>\d+)/$',
    'scorystapp.views.assign.assign'),
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<exam_id>\d+)/assign/\d+/students/$',
    'scorystapp.views.assign.get_students'),
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<exam_id>\d+)/assign/\d+/submissions/$',
    'scorystapp.views.assign.list_submissions'),
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<exam_id>\d+)/assign/\d+/submissions/(?P<submission_id>\d+)/$',
    'scorystapp.views.assign.manage_submission'),


  # Question part mapping
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/map-question-parts/$',
    'scorystapp.views.map_question_parts.map'),
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/map-question-parts/(?P<submission_id>\d+)/$',
    'scorystapp.views.map_question_parts.map'),
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/map-question-parts/\d+/get-all-submissions/$',
    'scorystapp.views.map_question_parts.get_all_exam_answers'),

  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/map-question-parts/(?P<submission_id>\d+)'
    '/get/$','scorystapp.views.map_question_parts.get_all_question_parts'),
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/map-question-parts/(?P<submission_id>\d+)'
    '/get/(?P<question_number>\d+)/(?P<part_number>\d+)/$',
    'scorystapp.views.map_question_parts.get_all_pages_on_question_part'),
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/map-question-parts/(?P<submission_id>\d+)'
    '/update/(?P<question_number>\d+)/(?P<part_number>\d+)/(?P<pages>.+)/$',
    'scorystapp.views.map_question_parts.update_pages_on_question_part'),


  # split pages
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/split/$',
    'scorystapp.views.split.split'),
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/split/pages/$',
    'scorystapp.views.split.get_pages'),
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/split/pages/(?P<split_page_id>\d+)/$',
    'scorystapp.views.split.update_split_page'),
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/split/finish/$',
    'scorystapp.views.split.finish_and_create_submissions'),


  # statistics
  url(r'^course/(?P<course_id>\d+)/statistics/$', 'scorystapp.views.statistics.statistics'),
  url(r'^course/(?P<course_id>\d+)/statistics/(?P<assessment_id>\d+)/get-statistics/$',
    'scorystapp.views.statistics.get_statistics'),
  url(r'^course/(?P<course_id>\d+)/statistics/(?P<assessment_id>\d+)/get-histogram/$',
    'scorystapp.views.statistics.get_histogram_for_assessment'),
  url(r'^course/(?P<course_id>\d+)/statistics/(?P<assessment_id>\d+)/get-histogram'
    '/(?P<question_number>\d+)/$',
    'scorystapp.views.statistics.get_histogram_for_question'),
  url(r'^course/(?P<course_id>\d+)/statistics/(?P<assessment_id>\d+)/get-histogram'
    '/(?P<question_number>\d+)/(?P<part_number>\d+)/$',
    'scorystapp.views.statistics.get_histogram_for_question_part'),

  # course assessments
  url(r'^course/(?P<course_id>\d+)/assessments/$',
    'scorystapp.views.assessments.assessments'),
  url(r'^course/(?P<course_id>\d+)/assessments/assessment/$',
    'scorystapp.views.assessments.list_assessments'),
  url(r'^course/(?P<course_id>\d+)/assessments/create/(?P<assessment_id>\d+)/assessment/$',
    'scorystapp.views.assessments.list_assessments'),
  url(r'^course/(?P<course_id>\d+)/assessments/create/(?P<assessment_id>\d+)/assessment/$',
    'scorystapp.views.assessments.list_question_parts'),
  url(r'^course/(?P<course_id>\d+)/assessments/delete/(?P<assessment_id>\d+)/$',
    'scorystapp.views.assessments.delete_assessment'),
  url(r'^course/(?P<course_id>\d+)/assessments/create/(?P<assessment_id>\d+)/$',
    'scorystapp.views.assessments.create_assessment'),
  url(r'^course/(?P<course_id>\d+)/assessments/create/(?P<assessment_id>\d+)/question-part/$',
    'scorystapp.views.assessments.list_question_parts'),

  # Uploading student exams
  url(r'^course/(?P<course_id>\d+)/upload/$', 'scorystapp.views.upload.upload'),
  url(r'^course/(?P<course_id>\d+)/upload/split-pages/(?P<exam_id>\d+)/$', 'scorystapp.views.upload.get_split_pages'),

  # Submitting student homework
  url(r'^course/(?P<course_id>\d+)/submit/$', 'scorystapp.views.submit.submit'),
  url(r'^course/(?P<course_id>\d+)/submit/(?P<course_user_id>\d+)/submissions/$', 'scorystapp.views.submit.get_submissions'),
  url(r'^course/(?P<course_id>\d+)/submit/(?P<submission_id>\d+)/$', 'scorystapp.views.submit.map_submission'),
  url(r'^course/(?P<course_id>\d+)/submit/(?P<submission_id>\d+)/submission-page/$', 'scorystapp.views.submit.get_submission_pages'),
  url(r'^course/(?P<course_id>\d+)/submit/(?P<submission_id>\d+)/response/$', 'scorystapp.views.submit.get_responses'),
  url(r'^course/(?P<course_id>\d+)/submit/(?P<submission_id>\d+)/response/(?P<response_id>\d+)/$', 'scorystapp.views.submit.update_response'),

  # Backbone's grade overview
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view)/$', 'scorystapp.views.overview.grade_overview'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view)/assessments/$', 'scorystapp.views.overview.get_assessments'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view)/(?P<assessment_id>\d+)/(?P<course_user_id>\d+)/response/$',
    'scorystapp.views.overview.get_responses'),

  # Students
  url(r'^course/(?P<course_id>\d+)/assessments/view/(?P<assessment_id>\d+)/get-self/$',
    'scorystapp.views.overview.get_self'),

  # TA/Instructor only
  url(r'^course/(?P<course_id>\d+)/grade/(?P<assessment_id>\d+)/get-students/$',
    'scorystapp.views.overview.get_students'),
  url(r'^course/(?P<course_id>\d+)/grade/(?P<assessment_id>\d+)/release/$',
    'scorystapp.views.overview.release_grades'),
  url(r'^course/(?P<course_id>\d+)/grade/(?P<assessment_id>\d+)/csv/$', 'scorystapp.views.get_csv.get_csv'),


  # course grading
  url(r'^course/(?P<course_id>\d+)/grade/(?P<submission_id>\d+)/$',
    'scorystapp.views.grade.grade'),


  # API for grading
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/response/$',
    'scorystapp.views.grade_or_view.list_responses'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/response/(?P<response_id>\d+)/$',
    'scorystapp.views.grade_or_view.manage_response'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/response/(?P<response_id>\d+)/rubrics/$',
    'scorystapp.views.grade_or_view.list_rubrics'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/response/(?P<response_id>\d+)/rubrics/(?P<rubric_id>\d+)/$',
    'scorystapp.views.grade_or_view.manage_rubric'),

  url(r'^course/(?P<course_id>\d+)/grade/(?P<submission_id>\d+)/get-previous-student/$',
   'scorystapp.views.grade.get_previous_student'),
  url(r'^course/(?P<course_id>\d+)/grade/(?P<submission_id>\d+)/get-next-student/$',
    'scorystapp.views.grade.get_next_student'),

  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/assessment-page/(?P<assessment_page_number>\d+)/annotation/$',
    'scorystapp.views.grade_or_view.list_annotations'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/assessment-page/(?P<assessment_page_number>\d+)/annotation/(?P<annotation_id>\d+)/$',
    'scorystapp.views.grade_or_view.manage_annotation'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/assessment-page/(?P<assessment_page_number>\d+)/get-freeform-annotation/$',
    'scorystapp.views.grade_or_view.get_freeform_annotation'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/assessment-page/(?P<assessment_page_number>\d+)/save-freeform-annotation/$',
    'scorystapp.views.grade_or_view.save_freeform_annotation'),

  # Update the `SplitPage`s as uploaded and (possibly) blank
  url(r'^update-split-page-state/$', 'scorystapp.views.upload.update_split_page_state'),

  # course student view assessment
  url(r'^course/(?P<course_id>\d+)/assessments/view/(?P<submission_id>\d+)/$',
    'scorystapp.views.view.view_assessment'),


  # For the assessment canvas
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/get-non-blank-pages/$',
    'scorystapp.views.grade_or_view.get_non_blank_pages'),
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<assessment_id>\d+)/(assign|map-question-parts)/(?P<submission_id>\d+)/get-non-blank-pages/$',
    'scorystapp.views.grade_or_view.get_non_blank_pages'),


  # create preview assessment
  url(r'^course/(?P<course_id>\d+)/assessments/preview/(?P<submission_id>\d+)/$',
    'scorystapp.views.view.preview_exam'),
  url(r'^course/(?P<course_id>\d+)/assessments/preview/(?P<submission_id>\d+)/edit$',
    'scorystapp.views.view.edit_created_exam'),
  url(r'^course/(?P<course_id>\d+)/assessments/preview/(?P<submission_id>\d+)/done$',
    'scorystapp.views.view.leave_created_exam'),


  # course grading or student view assessment or preview assessment
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/assessment-solutions-pdf/$',
    'scorystapp.views.grade_or_view.get_assessment_solutions_pdf'),
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/assessment-pdf/$',
    'scorystapp.views.grade_or_view.get_assessment_pdf'),


  # get assessment jpegs
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/get-assessment-jpeg/(?P<page_number>\d+)/$',
    'scorystapp.views.get_jpeg.get_assessment_jpeg'),
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<assessment_id>\d+)/(assign|map-question-parts)/(?P<submission_id>\d+)/get-assessment-jpeg/(?P<page_number>\d+)/$',
    'scorystapp.views.get_jpeg.get_assessment_jpeg'),


  # get large assessment jpegs
  url(r'^course/(?P<course_id>\d+)/(grade|assessments/view|assessments/preview)/(?P<submission_id>\d+)/get-assessment-jpeg-large/(?P<page_number>\d+)/$',
    'scorystapp.views.get_jpeg.get_assessment_jpeg_large'),
  url(r'^course/(?P<course_id>\d+)/assessments/(?P<assessment_id>\d+)/(assign|map-question-parts)/(?P<submission_id>\d+)/get-assessment-jpeg-large/(?P<page_number>\d+)/$',
    'scorystapp.views.get_jpeg.get_assessment_jpeg_large'),


  # get jpeg corresponding to student offset
  url(r'^course/(?P<course_id>\d+)/exams/(?P<exam_id>\d+)/(assign|map-question-parts)/(?P<submission_id>\d+)'
    '/get-student-jpeg/(?P<offset>(-?\d+))/(?P<page_number>\d+)/$',
    'scorystapp.views.get_jpeg.get_offset_student_jpeg'),
  url((r'^course/(?P<course_id>\d+)/grade/(?P<submission_id>\d+)/get-student-jpeg/'
    '(?P<offset>(-?\d+))/(?P<question_number>\d+)/$'),
    'scorystapp.views.get_jpeg.get_offset_student_jpeg_with_question_number'),


  # closest page for a response that has no pages
  url((r'^course/(?P<course_id>\d+)/grade/(?P<submission_id>\d+)/get-closest-page/'
    '(?P<question_number>\d+)/$'), 'scorystapp.views.get_jpeg.get_closest_page'),
  url((r'^course/(?P<course_id>\d+)/assessments/view/(?P<submission_id>\d+)/get-closest-page/'
    '(?P<question_number>\d+)/$'), 'scorystapp.views.get_jpeg.get_closest_page'),


  # get jpegs corresponding to a blank exam
  url(r'^course/(?P<course_id>\d+)/assessments/create/(?P<exam_id>\d+)/get-exam-jpeg/(?P<page_number>\d+)/$',
    'scorystapp.views.get_jpeg.get_blank_assessment_jpeg'),
  url(r'^course/(?P<course_id>\d+)/assessments/create/(?P<exam_id>\d+)/get-exam-jpeg-large/(?P<page_number>\d+)/$',
    'scorystapp.views.get_jpeg.get_blank_assessment_jpeg_large'),
  url(r'^course/(?P<course_id>\d+)/assessments/create/(?P<exam_id>\d+)/get-exam-page-count/$',
    'scorystapp.views.get_jpeg.get_blank_assessment_page_count'),


  # Reseting password
  url(r'^reset-password/password-sent/$', 'django.contrib.auth.views.password_reset_done',
    {
      'template_name': 'reset/password-reset-done.epy',
      'extra_context': {'title': 'Password Reset'}
    }),
  url(r'^reset-password/$', 'django.contrib.auth.views.password_reset',
    {
      'template_name': 'reset/password-reset-form.epy',
      'email_template_name': 'email/password-reset.epy',
      'extra_context': {'title': 'Password Reset'}
    }),
  url(r'^reset/(?P<uidb36>[0-9A-Za-z]+)-(?P<token>.+)/$',
    'django.contrib.auth.views.password_reset_confirm',
    {
      'template_name': 'reset/password-reset-confirm.epy',
      'set_password_form': forms.SetPasswordWithMinLengthForm,
      'extra_context': {'title': 'Password Reset'}
    }),
  url(r'^reset/done/$', 'django.contrib.auth.views.password_reset_complete',
    {
      'template_name': 'reset/password-reset-complete.epy',
      'extra_context': {'title': 'Password Reset Complete'}
    }),

  url(r'^accounts/change-password/$', 'scorystapp.views.auth.change_password'),
  url(r'^accounts/change-password/done$', 'scorystapp.views.auth.done_change_password'),

  # Uncomment the admin/doc line below to enable admin documentation:
  # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),
  # Next line enables the admin:
  url(r'^admin/', include(admin.site.urls)),
)

handler404 = 'scorystapp.views.error.not_found_error'
handler500 = 'scorystapp.views.error.server_error'

if settings.DEBUG:
  # show debug toolbar in debug mode
  urlpatterns += patterns('',
    url(r'^__debug__/', include(debug_toolbar.urls)),
  )
