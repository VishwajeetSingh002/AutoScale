# 1. Fetch latest Ubuntu 22.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"] # Canonical
}

# 2. Launch Template
resource "aws_launch_template" "web" {
  name_prefix   = "cloudscale-launch-template-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.web_profile.name
  }

  network_interfaces {
    associate_public_ip_address = true # Temporarily true so we can connect and view logs
    security_groups             = [aws_security_group.web_server.id]
  }

  # User Data Script to automatically bootstrap each new EC2 instance dynamically
  user_data = base64encode(<<-EOF
              #!/bin/bash
              # Redirect output to log file for debugging
              exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

              echo "=== Starting Bootstrap Script ==="
              apt-get update -y
              apt-get upgrade -y

              # Install Git, Node.js, NPM, AWS CLI and jq
              echo "=== Installing Packages ==="
              curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
              apt-get install -y nodejs git awscli jq mysql-client

              # Clone E-Commerce application
              echo "=== Cloning Repository ==="
              cd /home/ubuntu
              git clone https://github.com/VishwajeetSinghChauhan/AutoScale.git AutoScalingProject
              cd AutoScalingProject

              # Query Secrets Manager for database credentials securely
              echo "=== Fetching Database Credentials from Secrets Manager ==="
              SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.db_secret.arn} --region ${var.aws_region} --query SecretString --output text)
              
              DB_HOST_VAL=$(echo $SECRET_JSON | jq -r '.host')
              DB_USER_VAL=$(echo $SECRET_JSON | jq -r '.username')
              DB_PASS_VAL=$(echo $SECRET_JSON | jq -r '.password')
              DB_NAME_VAL=$(echo $SECRET_JSON | jq -r '.database')
              DB_PORT_VAL=$(echo $SECRET_JSON | jq -r '.port')

              # Initialize database schema and seed data if needed
              echo "=== Initializing Database Schema ==="
              mysql -h $DB_HOST_VAL -P $DB_PORT_VAL -u $DB_USER_VAL -p"$DB_PASS_VAL" $DB_NAME_VAL < database/schema.sql || true
              mysql -h $DB_HOST_VAL -P $DB_PORT_VAL -u $DB_USER_VAL -p"$DB_PASS_VAL" $DB_NAME_VAL < database/seed.sql || true

              # Construct the .env variables using the secret values
              echo "=== Configuring Environment Variables ==="
              cat <<EOT > backend/.env
PORT=5000
NODE_ENV=production
DB_HOST=$DB_HOST_VAL
DB_PORT=$DB_PORT_VAL
DB_USER=$DB_USER_VAL
DB_PASSWORD=$DB_PASS_VAL
DB_NAME=$DB_NAME_VAL
JWT_SECRET=supersecretkey123
AWS_REGION=${var.aws_region}
AWS_S3_BUCKET_NAME=${aws_s3_bucket.assets.id}
EOT

              # Install backend dependencies
              echo "=== Installing Backend Packages ==="
              cd backend
              npm install --only=production
              cd ..

              # Install frontend dependencies and build static assets
              echo "=== Compiling React Frontend ==="
              cd frontend
              npm install
              npm run build
              cd ..

              # Install PM2 globally to run Node application in background
              echo "=== Starting Application with PM2 ==="
              npm install -g pm2
              cd backend
              pm2 start server.js --name "cloudscale-backend"
              pm2 startup
              pm2 save

              echo "=== Bootstrap Complete ==="
              EOF
  )

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "cloudscale-launch-template"
  }
}

# 3. Auto Scaling Group (ASG)
resource "aws_autoscaling_group" "web_asg" {
  name_prefix               = "cloudscale-asg-v3-"
  vpc_zone_identifier       = aws_subnet.private_app[*].id
  target_group_arns         = [aws_lb_target_group.web_targets.arn]
  
  min_size                  = 1
  desired_capacity          = 2
  max_size                  = 6
  health_check_type         = "ELB"
  health_check_grace_period = 180
  wait_for_capacity_timeout = "0" # Prevents Terraform from hanging during applies

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }

  # Warm Pool configuration to keep pre-initialized stopped instances ready
  warm_pool {
    pool_state                  = "Stopped"
    min_size                    = 1
    max_group_prepared_capacity = 3
  }

  tag {
    key                 = "Name"
    value               = "cloudscale-web-node"
    propagate_at_launch = true
  }

  depends_on = [
    aws_secretsmanager_secret.db_secret
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# 4. Target Tracking Scaling Policy (Targeting 60% CPU Utilization)
resource "aws_autoscaling_policy" "cpu_target_tracking" {
  name                   = "cloudscale-cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.web_asg.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0 # Scale out when CPU exceeds 60%, scale in when below
  }
}