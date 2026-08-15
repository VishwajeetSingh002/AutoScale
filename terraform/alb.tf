# alb.tf

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

resource "aws_lb_target_group" "web_targets" {
  name_prefix = "cls-" # Exactly 4 characters (under the 6-char limit)
  port        = 5000        # Matches your Node.js backend port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id

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

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "cloudscale-web-targets"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.external.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_targets.arn
  }
}