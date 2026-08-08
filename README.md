# 🚀 AutoScale: Enterprise AWS Auto-Scaling E-Commerce Cluster

[![AWS Infrastructure](https://img.shields.io/badge/AWS-CloudFront%20%7C%20ALB%20%7C%20ASG%20%7C%20RDS%20%7C%20S3-orange.svg)](https://aws.amazon.com/)
[![IaC Terraform](https://img.shields.io/badge/IaC-HashiCorp%20Terraform-7B42BC.svg)](https://www.terraform.io/)
[![Stack React Node.js](https://img.shields.io/badge/Stack-React%20%7C%20TypeScript%20%7C%20Node.js-blue.svg)](https://react.dev/)
[![License MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade blueprint for a highly available, load-balanced, and elastically auto-scaled full-stack e-commerce web application deployed on Amazon Web Services (AWS) using HashiCorp Terraform.

---

## 📐 Infrastructure Architecture

```text
                                [ Clients / Web Browsers ]
                                            │
                                            ▼
                           [ AWS CloudFront CDN Distribution ]
                                (Global Edge Cache / TLS)
                                            │
                                            ▼
                            [ Application Load Balancer ]
                             (Public Subnets / Port 80)
                                            │
                          ┌─────────────────┴─────────────────┐
                          ▼                                   ▼
                [ EC2 Web Node 1 ]                  [ EC2 Web Node 2 ]
             (Private App Subnet AZ-A)           (Private App Subnet AZ-B)
                  │          │                        │          │
                  │          └───────────┬────────────┘          │
                  ▼                      ▼                       ▼
       [ Amazon RDS (MySQL) ]   [ Amazon ElastiCache ]   [ Amazon S3 Bucket ]
      (Multi-AZ Private DB)     (Redis Session Cache)    (Product Media Assets)
```

---

## ✨ Key Features & Capabilities

### 🛍️ E-Commerce Features
- **Dynamic Product Catalog**: High-resolution studio photography for all items, category filtering (`Electronics`, `Apparel`, `Home & Office`), and debounced search.
- **Interactive Shopping Cart & Checkout**: Real-time stock validation, sales tax calculation, free shipping thresholds, and transactional order confirmation.
- **Admin Management Panel**: Product registration modal supporting multipart image uploads to Amazon S3, and real-time customer order monitoring.
- **User Authentication**: Secure JWT token generation and bcrypt password hashing.

### ⚡ Cloud & Auto-Scaling Architecture
- **Elastic Auto Scaling**: Target Tracking Scaling Policy monitoring CPU utilization (scales between 2 and 6 EC2 instances dynamically).
- **Keyless Security (IAM Roles)**: Node.js AWS SDK utilizes AWS IAM Instance Profiles (`cloudscale-web-instance-profile`) without hardcoded credentials.
- **Automated Bootstrap (User Data)**: EC2 instances auto-initialize MySQL schema, seed data, compile React static assets, and pull catalog media from S3 upon boot.
- **Real-Time Telemetry Dashboard**: Built-in CPU stress generator for live scaling events demonstration.

---

## 📁 Repository Structure

```text
AutoScale/
├── backend/               # Node.js Express REST API (Auth, Orders, Products, Metrics)
│   ├── config/            # Database (MySQL), Cache (Redis), & S3 AWS SDK configurations
│   ├── routes/            # API Endpoints (/api/products, /api/orders, /api/metrics, /api/auth)
│   └── uploads/           # High-resolution catalog product images
├── database/              # MySQL database schemas (schema.sql) and seed data (seed.sql)
├── frontend/              # React + TypeScript + Vite SPA
│   └── src/views/         # Catalog, Cart, Telemetry Dashboard, Admin Panel, Auth screens
├── terraform/             # Complete AWS Infrastructure as Code (IaC) blueprints
│   ├── main.tf            # VPC, Subnets, Internet & NAT Gateways, Route Tables
│   ├── autoscaling.tf     # Launch Template, Auto Scaling Group, CPU Scaling Policy
│   ├── cloudfront.tf      # CloudFront CDN distribution & Cache Behaviors
│   ├── alb.tf             # Application Load Balancer, Target Groups, Health Checks
│   ├── rds.tf             # Amazon RDS MySQL Multi-AZ Instance & Secrets Manager
│   ├── s3.tf              # Amazon S3 Asset Bucket & Access Control Policies
│   └── iam.tf             # IAM Roles and EC2 Instance Profiles
└── README.md              # Documentation and walkthrough guide
```

---

## 🛠️ Quick Start Guide

### 1. Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install --prefix backend
   npm install --prefix frontend
   ```
2. **Start Development Cluster**:
   ```bash
   npm run dev
   ```
   - **Frontend UI**: `http://localhost:3000`
   - **Backend API**: `http://localhost:5000/api`

---

### 2. Deploying Infrastructure to AWS (Terraform)

1. **Configure AWS Credentials**:
   ```bash
   aws configure
   ```
2. **Initialize & Apply Terraform Blueprint**:
   ```bash
   cd terraform
   terraform init
   terraform plan
   terraform apply -auto-approve
   ```
3. **Outputs**:
   - `cloudfront_domain_name`: Global CDN Web URL
   - `alb_dns_name`: Application Load Balancer DNS
   - `rds_endpoint`: Amazon RDS MySQL Endpoint

---

## 🧪 Live Auto-Scaling Demonstration Walkthrough

1. **Baseline State**: Open the **Telemetry Monitor** tab. Observe 2 healthy target instances operating under baseline CPU utilization (~5%).
2. **Inject Load**: Click **"Inject High Traffic Load"** to initiate CPU stress tasks across target instances.
3. **CloudWatch Alarm**: Watch CPU utilization cross the 60% threshold.
4. **Scale Out**: AWS Auto Scaling Group automatically provisions a new EC2 instance to balance the load.
5. **Stabilization**: CPU utilization normalizes across the target group fleet.

---

## 🧹 Infrastructure Cleanup

To prevent unnecessary AWS charges when testing is complete:
```bash
cd terraform
terraform destroy -auto-approve
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
