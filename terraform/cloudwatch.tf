# cloudwatch.tf

# 1. Amazon Simple Notification Service (SNS) Topic for Scaling Alerts
resource "aws_sns_topic" "scaling_updates" {
  name         = "cloudscale-scaling-notifications"
  display_name = "CloudScale ASG Scaling Event updates"

  tags = {
    Name = "cloudscale-scaling-notifications"
  }
}

# 2. SNS Topic Subscription (Optional placeholder - e.g., email notification)
# To receive alerts, subscribe an email address using:
# resource "aws_sns_topic_subscription" "email_sub" {
#   topic_arn = aws_sns_topic.scaling_updates.arn
#   protocol  = "email"
#   endpoint  = "your-admin-email@domain.com"
# }

# 3. Auto Scaling Group Notification Configuration
resource "aws_autoscaling_notification" "asg_notifications" {
  group_names = [
    aws_autoscaling_group.web_asg.name
  ]

  notifications = [
    "autoscaling:EC2_INSTANCE_LAUNCH",
    "autoscaling:EC2_INSTANCE_TERMINATE",
    "autoscaling:EC2_INSTANCE_LAUNCH_ERROR",
    "autoscaling:EC2_INSTANCE_TERMINATE_ERROR",
  ]

  topic_arn = aws_sns_topic.scaling_updates.arn
}
