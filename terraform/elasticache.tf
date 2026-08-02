# elasticache.tf

# 1. ElastiCache Redis Subnet Group (restricts cluster to private DB subnets)
resource "aws_elasticache_subnet_group" "redis_subnets" {
  name        = "cloudscale-redis-subnet-group"
  subnet_ids  = aws_subnet.private_db[*].id
  description = "Subnet group for ElastiCache cluster"
}

# 2. ElastiCache Redis Cluster Node
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "cloudscale-session-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro" # Free Tier friendly instance class
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis_subnets.name
  security_group_ids = [aws_security_group.redis_cache.id]

  tags = {
    Name = "cloudscale-redis"
  }
}
