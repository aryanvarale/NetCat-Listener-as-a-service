from flask import Flask, request, jsonify
import boto3
import os
import time
import threading
import botocore
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

AWS_REGION = os.environ.get('AWS_REGION')
AMI_ID = os.environ.get('AMI_ID')
INSTANCE_TYPE = os.environ.get('INSTANCE_TYPE')
KEY_NAME = os.environ.get('KEY_NAME')
SECURITY_GROUP_NAME = os.environ.get('SECURITY_GROUP_NAME')
SECURITY_GROUP_ID = None

ec2 = boto3.resource('ec2', region_name=AWS_REGION)
ec2_client = boto3.client('ec2', region_name=AWS_REGION)

GOTTY_USER_DATA_SCRIPT = '''
#!/bin/bash
sudo apt update -y
sudo apt install -y wget netcat-openbsd
'''

def get_or_create_security_group(user_ip):
    global SECURITY_GROUP_ID
    if SECURITY_GROUP_ID:
        sg = ec2.SecurityGroup(SECURITY_GROUP_ID)
        return SECURITY_GROUP_ID
    existing_groups = list(ec2.security_groups.filter(GroupNames=[SECURITY_GROUP_NAME]))
    if existing_groups:
        sg = existing_groups[0]
        SECURITY_GROUP_ID = sg.id
        return sg.id
    sg = ec2.create_security_group(
        GroupName=SECURITY_GROUP_NAME,
        Description='Netcat listener security group',
    )
    sg.authorize_ingress(
        IpPermissions=[
            {
                'IpProtocol': 'tcp',
                'FromPort': 22,
                'ToPort': 22,
                'IpRanges': [{'CidrIp': f'{user_ip}/32'}]
            },
            {
                'IpProtocol': 'tcp',
                'FromPort': 4444,
                'ToPort': 5000,
                'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
            }
        ]
    )
    SECURITY_GROUP_ID = sg.id
    return sg.id

last_instance_info = {}

@app.route('/launch-instance', methods=['POST'])
def launch_instance():
    data = request.get_json()
    user_ip = data.get('user_ip')
    user_email = data.get('user_email') if 'user_email' in data else None

    user_data_script = GOTTY_USER_DATA_SCRIPT

    sg_id = get_or_create_security_group(user_ip)

    try:
        instance = ec2.create_instances(
            ImageId=AMI_ID,
            InstanceType=INSTANCE_TYPE,
            KeyName=KEY_NAME,
            SecurityGroupIds=[sg_id],
            MinCount=1,
            MaxCount=1,
            UserData=user_data_script
        )[0]
    except botocore.exceptions.ClientError as e:
        print(f"[DEBUG] boto3 ClientError: {e}")
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        print(f"[DEBUG] Exception: {e}")
        return jsonify({'error': str(e)}), 500

    instance.wait_until_running()
    instance.reload()

    public_ip = instance.public_ip_address
    ssh_command = f'ssh -i <your-key.pem> ubuntu@{public_ip}'
    netcat_command = f'nc -lvnp 4444'

    last_instance_info['public_ip'] = public_ip
    last_instance_info['username'] = 'ubuntu'
    last_instance_info['key_path'] = os.path.abspath('netcat-key.pem')
    last_instance_info['instance_id'] = instance.id

    def terminate_later(instance_id):
        import time
        time.sleep(900)
        try:
            ec2.Instance(instance_id).terminate()
            print(f"[DEBUG] Instance {instance_id} terminated after timeout.")
            if last_instance_info.get('instance_id') == instance_id:
                last_instance_info.clear()
        except Exception as e:
            print(f"[DEBUG] Error terminating instance: {e}")
    threading.Thread(target=terminate_later, args=(instance.id,), daemon=True).start()

    return jsonify({
        'instance_id': instance.id,
        'public_ip': public_ip,
        'ssh_command': ssh_command,
        'netcat_command': netcat_command,
        'status': instance.state['Name']
    })

@app.route('/terminate-instance', methods=['POST'])
def terminate_instance():
    data = request.get_json()
    instance_id = data.get('instance_id')
    if not instance_id:
        return jsonify({'error': 'instance_id is required'}), 400
    try:
        instance = ec2.Instance(instance_id)
        instance.terminate()
        return jsonify({'status': 'terminated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 