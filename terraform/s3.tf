# s3.tf

# Generate a random string to ensure globally unique S3 bucket name
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# 1. Create S3 Bucket
resource "aws_s3_bucket" "assets" {
  bucket        = "cloudscale-assets-${random_id.bucket_suffix.hex}"
  force_destroy = true # Allows deletion of bucket even if files are inside when running terraform destroy

  tags = {
    Name        = "cloudscale-assets-bucket"
    Environment = "production"
  }
}

# 2. Configure Ownership Controls
resource "aws_s3_bucket_ownership_controls" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# 3. Disable Block Public Access to allow reading images in browser
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# 4. Create Public Read Bucket Policy
resource "aws_s3_bucket_policy" "allow_public_read" {
  bucket = aws_s3_bucket.assets.id

  # Ensure public access block is updated before setting policy
  depends_on = [
    aws_s3_bucket_public_access_block.assets,
    aws_s3_bucket_ownership_controls.assets
  ]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.assets.arn}/*"
      }
    ]
  })
}
