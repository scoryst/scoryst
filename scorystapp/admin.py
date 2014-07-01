from django.contrib import admin
from scorystapp import models


class UserAdmin(admin.ModelAdmin):
  search_fields = ['first_name', 'last_name', 'email', 'student_id']
  list_display = ['first_name', 'last_name', 'email', 'student_id']


class CourseUserAdmin(admin.ModelAdmin):
  search_fields = ['user__email', 'user__first_name', 'user__last_name']
  list_display = ['user', 'course', 'privilege']


class ExamPageAdmin(admin.ModelAdmin):
  search_fields = ['exam__name', 'page_number', 'exam__course__name']
  list_display = ['exam', 'page_number']


class QuestionPartAdmin(admin.ModelAdmin):
  search_fields = ['assessment__course__name', 'assessment__name', 'question_number',
    'part_number', 'max_points', 'pages']
  list_display = ['assessment', 'question_number', 'part_number', 'max_points', 'pages']


class RubricAdmin(admin.ModelAdmin):
  search_fields = ['question_part__assessment__name', 'question_part__assessment__course__name',
    'question_part__question_number', 'question_part__part_number', 'description', 'points']
  list_display = ['question_part', 'description', 'points']


class SubmissionAdmin(admin.ModelAdmin):
  search_fields = ['course_user__user__email', 'course_user__course__name',
    'course_user__user__first_name', 'course_user__user__last_name', 'assessment__name']
  list_display = ['assessment', 'course_user', 'page_count', 'released']


class SubmissionPageAdmin(admin.ModelAdmin):
  search_fields = ['submission__course_user__user__email', 'submission__course_user__course__name',
    'submission__course_user__user__first_name', 'submission__course_user__user__last_name',
    'submission__assessment__name']
  list_display = ['submission', 'page_number', 'is_blank']


class ResponseAdmin(admin.ModelAdmin):
  search_fields = ['submission__course_user__user__email', 'submission__course_user__course__name',
    'submission__course_user__user__first_name', 'submission__course_user__user__last_name',
    'submission__assessment__name']
  list_display = ['submission', 'pages', 'question_part']


admin.site.register(models.User, UserAdmin)
admin.site.register(models.CourseUser, CourseUserAdmin)
admin.site.register(models.Course)
admin.site.register(models.Assessment)
admin.site.register(models.Exam)
admin.site.register(models.Homework)
admin.site.register(models.ExamPage, ExamPageAdmin)
admin.site.register(models.QuestionPart, QuestionPartAdmin)
admin.site.register(models.Rubric, RubricAdmin)
admin.site.register(models.Submission, SubmissionAdmin)
admin.site.register(models.SubmissionPage, SubmissionPageAdmin)
admin.site.register(models.Response, ResponseAdmin)
admin.site.register(models.Annotation)
admin.site.register(models.Split)
admin.site.register(models.SplitPage)
