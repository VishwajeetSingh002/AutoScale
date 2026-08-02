# outputs.tf

output "alb_dns_name" {
  value       = aws_lb.external.dns_name
  description = "The public DNS name of the Application Load Balancer"
}

output "rds_endpoint" {
  value       = aws_db_instance.mysql.endpoint
  description = "The connection endpoint for the RDS MySQL Database"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.assets.id
  description = "The globally unique name of the S3 Bucket created"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.cdn.domain_name
  description = "The public domain name of the CloudFront edge distribution"
}
