import subprocess
import json
import time

print 'Spinning up instance'
output_json = subprocess.check_output(['aws', 'ec2', 'run-instances',
  '--image-id', 'ami-9c91acd9', '--count', '1', '--instance-type', 'm1.xlarge',
  '--key-name', 'scoryst', '--security-groups', 'basic'])

output = json.loads(output_json) 
instance_id = output['Instances'][0]['InstanceId']
print 'Instance ID %s' % instance_id

try:
  while True: 
    describe_output_json =  subprocess.check_output(['aws', 'ec2',
      'describe-instances', '--instance-ids', '%s' % instance_id])
    describe_output = json.loads(describe_output_json)
    status = describe_output['Reservations'][0]['Instances'][0]['State']['Name']
    
    if status == 'running':
      break
    
    print 'Status is %s, rechecking in 3 seconds' % status
    time.sleep(3)

  print 'Status is running!'
  public_ip = describe_output['Reservations'][0]['Instances'][0]['PublicIpAddress']
  print 'IP address is %s' % public_ip

  while True:
    try:
      subprocess.check_call(['ssh', '-o', 'StrictHostKeyChecking no', '-i',
        'scoryst.pem', 'ubuntu@%s' % public_ip, 'echo', 'Hello'])
    except subprocess.CalledProcessError:
      print 'Could not ssh into %s; retrying in 2 seconds.' % public_ip
      time.sleep(2)
    else:
      print 'Successfully reached %s' % public_ip
      break

  print 'Copying files'
  subprocess.check_call(['scp', '-o', 'StrictHostKeyChecking no', '-i',
    'scoryst.pem', 'run-job.sh', 'ubuntu@%s:~' % public_ip])
  subprocess.check_call(['scp', '-o', 'StrictHostKeyChecking no', '-i',
    'scoryst.pem', '-r', 'converter', 'ubuntu@%s:~' % public_ip])

  print 'Running job'
  subprocess.check_call(['ssh', '-o', 'StrictHostKeyChecking no', '-i',
    'scoryst.pem', 'ubuntu@%s' % public_ip, 'bash', '-s', '<', 'run-job.sh'])
finally:
  print 'Terminating instance'
  output_json = subprocess.check_output(['aws', 'ec2', 'terminate-instances',
    '--instance-ids', instance_id])
