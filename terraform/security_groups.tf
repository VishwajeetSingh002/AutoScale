# security_groups.tf

# 1. ALB Security Group (Open to HTTP/HTTPS)
resource "aws_security_group" "alb" {
  name        = "cloudscale-alb-sg"
  description = "Allows ingress from public internet on HTTP/HTTPS"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudscale-alb-sg"
  }
}

# 2. EC2 Web Server Security Group
resource "aws_security_group" "web_server" {
  name        = "cloudscale-web-sg"
  description = "Allows traffic from ALB target group and SSH access"
  vpc_id      = aws_vpc.main.id

  # Allow HTTP traffic from ALB on API Port 5000
  ingress {
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow HTTP traffic from ALB on Frontend Web Port 3000
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow SSH traffic from restricted Administrator IP
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudscale-web-sg"
  }
}

# 3. Database RDS Security Group (Isolate from public internet)
resource "aws_security_group" "db_server" {
  name        = "cloudscale-db-sg"
  description = "Allows MySQL ingress ONLY from Web Servers SG"
  vpc_id      = aws_vpc.main.id

  # Allow MySQL connections ONLY from web server instances on port 3306
  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.web_server.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudscale-db-sg"
  }
}

# 4. Redis Cache Security Group (Isolate cache node)
resource "aws_security_group" "redis_cache" {
  name        = "cloudscale-redis-sg"
  description = "Allows Redis TCP ingress strictly from Web Servers SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.web_server.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudscale-redis-sg"
  }
}
