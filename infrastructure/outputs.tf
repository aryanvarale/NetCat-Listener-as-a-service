output "instance_id" {
  value = aws_instance.netcat.id
}

output "public_ip" {
  value = aws_instance.netcat.public_ip
} 