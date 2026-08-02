# iam.tf

# 1. IAM Assume Role Policy for EC2
resource "aws_iam_role" "ec2_role" {
  name = "cloudscale-ec2-s3-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "cloudscale-ec2-s3-role"
  }
}

# 2. IAM Policy granting access to S3 Bucket & Secrets Manager
resource "aws_iam_role_policy" "s3_access" {
  name = "cloudscale-ec2-s3-policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.assets.arn,
          "${aws_s3_bucket.assets.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_secret.arn
        ]
      }
    ]
  })
}

# 3. EC2 Instance Profile (Binds IAM role to EC2 launch templates)
resource "aws_iam_instance_profile" "web_profile" {
  name = "cloudscale-web-instance-profile"
  role = aws_iam_role.ec2_role.name
}
