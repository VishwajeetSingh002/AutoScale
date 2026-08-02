# variables.tf
variable "aws_region" {
  type        = string
  description = "AWS deployment region"
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets (ALB & IGW)"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for app subnets (EC2 ASG)"
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "private_db_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for database subnets (RDS)"
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "db_username" {
  type        = string
  description = "Master username for RDS MySQL"
  default     = "dbadmin"
}

variable "db_password" {
  type        = string
  description = "Master password for RDS MySQL"
  default     = "CloudScaleSecretPass2026"
  sensitive   = true
}

variable "instance_type" {
  type        = string
  description = "EC2 instance size for the web servers"
  default     = "t3.micro"
}

variable "ssh_allowed_ip" {
  type        = string
  description = "Your public IP CIDR for SSH access restriction"
  default     = "0.0.0.0/0" # In production, restrict to your exact public IP (e.g., "73.23.45.12/32")
}
