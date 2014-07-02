# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import DataMigration
from django.db import models

def update_response(response):
    """ Updates the `points` and `graded` fields of response """
    response.points = get_response_points(response)
    response.graded = is_response_graded(response)
    response.save()

def is_response_graded(response):
    """ Returns true if this question part answer is graded, or false otherwise. """
    return response.rubrics.count() > 0 or response.custom_points is not None

def get_response_points(response):
    """ Returns the number of points the student received for this answer. """
    # sum all rubric points
    total_points = 0
    for rubric in response.rubrics.all():
        total_points += rubric.points

    custom_points = response.custom_points if response.custom_points else 0
    if response.submission.assessment.grade_down:
        # if we're grading down, subtract total from max points
        points = response.question_part.max_points - total_points + custom_points
    else:
        # otherwise, we're awarding points
        points = total_points + custom_points

    if response.submission.assessment.cap_score:
        # assessments where grade down is the option caps score to be non-negative
        if response.submission.assessment.grade_down:
            points = max(0, points)
        else:  # if grade up, scores cannot exceed the maximum
            points = min(response.question_part.max_points, points)
    return points

def update_submission(submission):
    submission.points = get_submission_points(submission)
    submission.graded = is_submission_graded(submission)
    submission.save()

def is_submission_graded(submission):
    """ Returns true if this exam is graded, or false otherwise. """
    responses = submission.response_set.all()
    for response in responses:
        if not is_response_graded(response):
            return False
    return True

def get_submission_points(submission):
    """ Returns the score of the student for this submission. """
    responses = submission.response_set.all()
    points = 0
    for response in responses:
        points += get_response_points(response)
    return points

class Migration(DataMigration):

    def forwards(self, orm):
        """
        Update the response and submission models with the correct `points` and
        `graded` fields
        """
        responses = orm.Response.objects.all().prefetch_related(
            'submission',
            'submission__assessment',
            'question_part',
            'rubrics',
        )

        submissions = orm.Submission.objects.all().prefetch_related(
            'response_set',
            'response_set__submission',
            'response_set__submission__assessment',
            'response_set__question_part',
            'response_set__rubrics',
        )

        for response in responses:
            update_response(response)

        for submission in submissions:
            update_submission(submission)

    def backwards(self, orm):
        raise Exception('Sorry, you cannot backwards migrate.')

    models = {
        u'auth.group': {
            'Meta': {'object_name': 'Group'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '80'}),
            'permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'})
        },
        u'auth.permission': {
            'Meta': {'ordering': "(u'content_type__app_label', u'content_type__model', u'codename')", 'unique_together': "((u'content_type', u'codename'),)", 'object_name': 'Permission'},
            'codename': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'content_type': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['contenttypes.ContentType']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'})
        },
        u'contenttypes.contenttype': {
            'Meta': {'ordering': "('name',)", 'unique_together': "(('app_label', 'model'),)", 'object_name': 'ContentType', 'db_table': "'django_content_type'"},
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'model': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'})
        },
        u'scorystapp.annotation': {
            'Meta': {'object_name': 'Annotation'},
            'comment': ('django.db.models.fields.TextField', [], {'max_length': '1000', 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'offset_left': ('django.db.models.fields.FloatField', [], {}),
            'offset_top': ('django.db.models.fields.FloatField', [], {}),
            'rubric': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Rubric']", 'null': 'True', 'blank': 'True'}),
            'submission_page': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.SubmissionPage']"})
        },
        u'scorystapp.assessment': {
            'Meta': {'object_name': 'Assessment'},
            'cap_score': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'course': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Course']"}),
            'grade_down': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'solutions_pdf': ('django.db.models.fields.files.FileField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'})
        },
        u'scorystapp.course': {
            'Meta': {'object_name': 'Course'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'student_enroll_token': ('django.db.models.fields.CharField', [], {'max_length': '10'}),
            'ta_enroll_token': ('django.db.models.fields.CharField', [], {'max_length': '10'}),
            'term': ('django.db.models.fields.IntegerField', [], {}),
            'year': ('django.db.models.fields.IntegerField', [], {'default': '2014'})
        },
        u'scorystapp.courseuser': {
            'Meta': {'object_name': 'CourseUser'},
            'course': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Course']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'privilege': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.User']"})
        },
        u'scorystapp.exam': {
            'Meta': {'object_name': 'Exam', '_ormbases': [u'scorystapp.Assessment']},
            u'assessment_ptr': ('django.db.models.fields.related.OneToOneField', [], {'to': u"orm['scorystapp.Assessment']", 'unique': 'True', 'primary_key': 'True'}),
            'exam_pdf': ('django.db.models.fields.files.FileField', [], {'max_length': '100', 'blank': 'True'}),
            'page_count': ('django.db.models.fields.IntegerField', [], {})
        },
        u'scorystapp.exampage': {
            'Meta': {'object_name': 'ExamPage'},
            'exam': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Exam']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'page_jpeg': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_jpeg_large': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_number': ('django.db.models.fields.IntegerField', [], {})
        },
        u'scorystapp.homework': {
            'Meta': {'object_name': 'Homework', '_ormbases': [u'scorystapp.Assessment']},
            u'assessment_ptr': ('django.db.models.fields.related.OneToOneField', [], {'to': u"orm['scorystapp.Assessment']", 'unique': 'True', 'primary_key': 'True'}),
            'submission_deadline': ('django.db.models.fields.DateTimeField', [], {})
        },
        u'scorystapp.questionpart': {
            'Meta': {'object_name': 'QuestionPart'},
            'assessment': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Assessment']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'max_points': ('django.db.models.fields.FloatField', [], {}),
            'pages': ('django.db.models.fields.CommaSeparatedIntegerField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'part_number': ('django.db.models.fields.IntegerField', [], {'null': 'True'}),
            'question_number': ('django.db.models.fields.IntegerField', [], {})
        },
        u'scorystapp.response': {
            'Meta': {'object_name': 'Response'},
            'custom_points': ('django.db.models.fields.FloatField', [], {'null': 'True', 'blank': 'True'}),
            'graded': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'grader': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.CourseUser']", 'null': 'True', 'blank': 'True'}),
            'grader_comments': ('django.db.models.fields.TextField', [], {'max_length': '1000', 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'pages': ('django.db.models.fields.CommaSeparatedIntegerField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'points': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'question_part': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.QuestionPart']"}),
            'rubrics': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['scorystapp.Rubric']", 'symmetrical': 'False'}),
            'submission': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Submission']"})
        },
        u'scorystapp.rubric': {
            'Meta': {'object_name': 'Rubric'},
            'description': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'points': ('django.db.models.fields.FloatField', [], {}),
            'question_part': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.QuestionPart']"})
        },
        u'scorystapp.split': {
            'Meta': {'object_name': 'Split'},
            'exam': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Exam']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'pdf': ('django.db.models.fields.files.FileField', [], {'max_length': '100'}),
            'secret': ('django.db.models.fields.TextField', [], {'max_length': '1000'})
        },
        u'scorystapp.splitpage': {
            'Meta': {'object_name': 'SplitPage'},
            'begins_submission': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_blank': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_uploaded': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'page_jpeg': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_jpeg_large': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_jpeg_small': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_number': ('django.db.models.fields.IntegerField', [], {}),
            'split': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Split']"})
        },
        u'scorystapp.submission': {
            'Meta': {'object_name': 'Submission'},
            'assessment': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Assessment']"}),
            'course_user': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.CourseUser']", 'null': 'True', 'blank': 'True'}),
            'graded': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'page_count': ('django.db.models.fields.IntegerField', [], {}),
            'pdf': ('django.db.models.fields.files.FileField', [], {'max_length': '100'}),
            'points': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'preview': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'released': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'time': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'})
        },
        u'scorystapp.submissionpage': {
            'Meta': {'object_name': 'SubmissionPage'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_blank': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'page_jpeg': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_jpeg_large': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_jpeg_small': ('django.db.models.fields.files.ImageField', [], {'max_length': '100', 'blank': 'True'}),
            'page_number': ('django.db.models.fields.IntegerField', [], {}),
            'submission': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['scorystapp.Submission']"})
        },
        u'scorystapp.user': {
            'Meta': {'object_name': 'User'},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'unique': 'True', 'max_length': '100', 'db_index': 'True'}),
            'first_name': ('django.db.models.fields.CharField', [], {'max_length': '30'}),
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Group']", 'symmetrical': 'False', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_signed_up': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_name': ('django.db.models.fields.CharField', [], {'max_length': '30'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'student_id': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'user_permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'})
        }
    }

    complete_apps = ['scorystapp']
    symmetrical = True
