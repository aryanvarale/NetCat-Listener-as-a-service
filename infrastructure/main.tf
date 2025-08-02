provider "aws" {
  region = var.aws_region
}

resource "aws_security_group" "netcat_sg" {
  name        = "netcat-sg"
  description = "Allow SSH and Netcat ports from user IP"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.user_ip_cidr]
  }

  ingress {
    from_port   = 4444
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = [var.user_ip_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "netcat" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.netcat_sg.id]

  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "netcat-listener"
  }
}

variable "aws_region" {
  description = "AWS region"
  default     = "ap-south-1"
}

variable "ami_id" {
  description = "AMI ID"
  default     = "ami-0c1a7f89451184c8b"
}

variable "instance_type" {
  description = "EC2 instance type"
  default     = "t2.micro"
}

variable "key_name" {
  description = "SSH key name"
}

variable "user_ip_cidr" {
  description = "User IP in CIDR format (e.g. 1.2.3.4/32)"
} 