from rest_framework import serializers
from scorystapp import models


class SplitPageSerializer(serializers.ModelSerializer):
  page_jpeg_small_url = serializers.CharField(source='page_jpeg_small.url', read_only=True)
  page_jpeg_url = serializers.CharField(source='page_jpeg.url', read_only=True)

  class Meta:
    model = models.SplitPage
    fields = ('id', 'begins_exam_answer', 'page_number',
      'page_jpeg_small_url', 'page_jpeg_url')
    read_only_fields = ('id', 'page_number')
