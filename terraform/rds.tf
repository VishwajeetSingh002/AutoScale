# rds.tf

# 1. DB Subnet Group (Specifies which subnets the database resides in)
resource "aws_db_subnet_group" "db_subnets" {
  name        = "cloudscale-db-subnet-group"
  subnet_ids  = aws_subnet.private_db[*].id
  description = "RDS subnet group spanning private DB subnets"

  tags = {
    Name = "cloudscale-db-subnet-group"
  }
}

# 2. Generate a secure random password for RDS
resource "random_password" "db_password" {
  length  = 18
  special = false
}

# 3. Create Secrets Manager secret container
resource "aws_secretsmanager_secret" "db_secret" {
  name                    = "cloudscale-db-secret-${random_id.bucket_suffix.hex}"
  description             = "Master credentials for RDS MySQL database"
  recovery_window_in_days = 0 # Avoids pending deletion locks during terraform destroy runs

  tags = {
    Name = "cloudscale-db-secret"
  }
}

# 4. Populate Secret Version with database parameters
resource "aws_secretsmanager_secret_version" "db_secret_ver" {
  secret_id = aws_secretsmanager_secret.db_secret.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.mysql.address
    database = "ecommerce_db"
    port     = 3306
  })
}

# 5. RDS MySQL Database Instance (Multi-AZ Resilient)
resource "aws_db_instance" "mysql" {
  identifier             = "cloudscale-rds-mysql"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp2"
  engine                 = "mysql"
  engine_version         = "8.0"
  instance_class         = "db.t3.micro" # Free Tier eligible size
  
  db_name                = "ecommerce_db"
  username               = var.db_username
  password               = random_password.db_password.result
  
  db_subnet_group_name   = aws_db_subnet_group.db_subnets.name
  vpc_security_group_ids = [aws_security_group.db_server.id]
  
  multi_az               = true # Enable automatic multi-AZ failover and synchronous replica
  publicly_accessible    = false
  skip_final_snapshot    = true  # Fast teardown; do not create snapshot upon running terraform destroy

  tags = {
    Name        = "cloudscale-rds-mysql"
    Environment = "production"
  }
}
