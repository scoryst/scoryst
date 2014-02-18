import subprocess
import json
import time

output_json = subprocess.check_output(['aws', 'ec2', 'run-instances',
  '--image-id', 'ami-9c91acd9', '--count', '1', '--instance-type', 'm1.xlarge',
  '--key-name', 'scoryst', '--security-groups', 'basic'])
output = json.loads(output_json) 

instance_id = output['Instances'][0]['InstanceId']

while True: 
  describe_output_json =  subprocess.check_output(['aws', 'ec2', 'describe-instances', '--instance-ids', '%s' % instance_id])
  describe_output = json.loads(describe_output_json)
  status = describe_output['Reservations'][0]['Instances'][0]['State']['Name']
  
  if status == 'running':
    break
  
  print 'Status is %s, sleeping for 3 seconds before trying again' % status
  time.sleep(3)

print 'Sleeping for 50s. This is needed because we need some time before we can scp the required files'
time.sleep(50)
print 'Status is running!'

public_ip =  describe_output['Reservations'][0]['Instances'][0]['PublicIpAddress']
print 'Public IP is: ', public_ip

subprocess.check_call(['scp', '-o', 'StrictHostKeyChecking no', '-i', 'scoryst.pem', 'run-job.sh', 'ubuntu@%s:~' % public_ip])
subprocess.check_call(['scp', '-o', 'StrictHostKeyChecking no', '-i', 'scoryst.pem', '-r', 'converter', 'ubuntu@%s:~' % public_ip])

subprocess.check_call(['ssh', '-o', 'StrictHostKeyChecking no', '-i', 'scoryst.pem', 'ubuntu@%s' % public_ip, 'bash', '-s', '<', 'run-job.sh'])
