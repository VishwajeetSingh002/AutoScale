# cloudfront.tf

# 1. Private S3 Bucket for Frontend Static Assets
resource "aws_s3_bucket" "frontend" {
  bucket        = "cloudscale-frontend-${random_id.bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name = "cloudscale-frontend-bucket"
  }
}

# 2. Block public access to the frontend bucket (must access via CloudFront OAC)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 3. CloudFront Origin Access Control (OAC) for secure S3 access
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "cloudscale-frontend-oac"
  description                       = "OAC for E-Commerce React Frontend S3 Bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "assets_oac" {
  name                              = "cloudscale-assets-oac"
  description                       = "OAC for E-Commerce Assets S3 Bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 4. S3 Bucket Policy allowing CloudFront OAC to read objects
resource "aws_s3_bucket_policy" "frontend_policy" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn
          }
        }
      }
    ]
  })
}

# 5. CloudFront Distribution (Multi-Origin Setup)
resource "aws_cloudfront_distribution" "cdn" {
  enabled         = true
  is_ipv6_enabled = true

  # Origin 1: Primary Application Load Balancer
  origin {
    domain_name = aws_lb.external.dns_name
    origin_id   = "ALB-Backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Origin 2: S3 Bucket for Media Uploads & Assets
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-Assets"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default Cache Behavior: Route all requests directly to ALB origin
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Accept"]
      cookies {
        forward = "all"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "cloudscale-cloudfront"
  }
}
