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
  search_fields = ['exam__course__name', 'exam__name', 'question_number',
    'part_number', 'max_points', 'pages']
  list_display = ['exam', 'question_number', 'part_number', 'max_points', 'pages']


class RubricAdmin(admin.ModelAdmin):
  search_fields = ['question_part__exam__name', 'question_part__exam__course__name',
    'question_part__question_number', 'question_part__part_number', 'description', 'points']
  list_display = ['question_part', 'description', 'points']


class ExamAnswerAdmin(admin.ModelAdmin):
  search_fields = ['course_user__user__email', 'course_user__course__name',
    'course_user__user__first_name', 'course_user__user__last_name', 'exam__name']
  list_display = ['exam', 'course_user', 'page_count', 'preview', 'released']


class QuestionPartAnswerAdmin(admin.ModelAdmin):
  search_fields = ['exam_answer__course_user__user__email', 'exam_answer__course_user__course__name',
    'exam_answer__course_user__user__first_name', 'exam_answer__course_user__user__last_name',
    'exam_answer__exam__name']
  list_display = ['exam_answer', 'pages', 'question_part']


class ExamAnswerPageAdmin(admin.ModelAdmin):
  search_fields = ['exam_answer__course_user__user__email', 'exam_answer__course_user__course__name',
    'exam_answer__course_user__user__first_name', 'exam_answer__course_user__user__last_name',
    'exam_answer__exam__name']
  list_display = ['exam_answer', 'page_number']


admin.site.register(models.User, UserAdmin)
admin.site.register(models.CourseUser, CourseUserAdmin)
admin.site.register(models.Course)
admin.site.register(models.Exam)
admin.site.register(models.ExamPage, ExamPageAdmin)
admin.site.register(models.QuestionPart, QuestionPartAdmin)
admin.site.register(models.Rubric, RubricAdmin)
admin.site.register(models.ExamAnswer, ExamAnswerAdmin)
admin.site.register(models.ExamAnswerPage, ExamAnswerPageAdmin)
admin.site.register(models.QuestionPartAnswer, QuestionPartAnswerAdmin)
admin.site.register(models.Split)
admin.site.register(models.SplitPage)
