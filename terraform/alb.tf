# alb.tf

# 1. Application Load Balancer (ALB)
resource "aws_lb" "external" {
  name               = "cloudscale-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name        = "cloudscale-alb"
    Environment = "production"
  }
}

# 2. ALB Target Group (Points to EC2 Instances on port 5000)
resource "aws_lb_target_group" "web_targets" {
  name     = "cloudscale-target-group"
  port     = 5000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/api/metrics/health"
    port                = "5000"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name = "cloudscale-web-targets"
  }
}

# 3. HTTP Listener (Port 80 routing to Web Target Group)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.external.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_targets.arn
  }
}
