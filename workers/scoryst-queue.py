from iron_worker import *

worker = IronWorker()
response = worker.queue(code_name="converter", payload={
  's3': {
    'token': 'AKIAIW5YEHNKKPSWWKIA',
    'secret': '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',
    'bucket': 'scoryst-demo',
  },

  'pdf_paths': ['exam-pdf/bryan.pdf'],
  'jpeg_prefixes': ['exam-pages/bryan-iron'],
})
