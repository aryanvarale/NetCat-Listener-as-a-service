# Netcat Cloud Listener Infrastructure (Terraform)

This directory contains Terraform scripts to provision the AWS resources for the Netcat listener platform.

## What it does
- Provisions an EC2 instance with a security group
- Restricts SSH (22) and Netcat (4444-5000) to your IP
- Installs netcat and auto-shutdowns after 30 minutes

## Prerequisites
- [Terraform](https://www.terraform.io/downloads.html)
- AWS credentials configured (via `aws configure` or environment variables)

## Usage

1. Edit variables as needed in `main.tf` or pass via CLI:
   - `key_name`: Your AWS EC2 SSH key name
   - `user_ip_cidr`: Your IP in CIDR format (e.g. `1.2.3.4/32`)

2. Initialize and apply:
   ```bash
   terraform init
   terraform apply -var="key_name=YOUR_KEY" -var="user_ip_cidr=YOUR_IP/32"
   ```

3. Outputs:
   - Instance ID
   - Public IP

4. SSH Example:
   ```bash
   ssh -i <your-key.pem> ec2-user@<public-ip>
   ```

## Cleanup
To avoid charges, destroy resources when done:
```bash
terraform destroy -var="key_name=YOUR_KEY" -var="user_ip_cidr=YOUR_IP/32"
``` 