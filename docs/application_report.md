# Systems Engineering Report: Elastic E-Commerce Architecture on AWS

This document provides a detailed technical analysis of the **Enterprise-Grade Elastic E-Commerce Cluster** blueprint. The repository is designed as a production-ready blueprint implementing auto-scaling dynamic compute instances, edge caching, decoupled database states, and secure privilege boundaries on Amazon Web Services (AWS).

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Component Directory Structure](#2-directory-structure)
3. [Core Engineering Features & Fallback Design](#3-core-engineering-features--fallback-design)
4. [Infrastructure-as-Code (Terraform) Blueprint](#4-infrastructure-as-code-terraform-blueprint)
5. [Software Implementation Details](#5-software-implementation-details)
6. [Telemetry & 4-Phase Scale Walkthrough](#6-telemetry--4-phase-scale-walkthrough)
7. [CI/CD Deployment Pipelines](#7-cicd-deployment-pipelines)
8. [Conclusion & Recommendations](#8-conclusion--recommendations)

---

## 1. Architecture Overview

The system is designed around a fully stateless application tier decoupled from state storage, using edge caching to offload static asset requests.

```text
                  [ Clients / Web Users ]
                             │
                             ▼
                  [ AWS CloudFront CDN ]
                   /                  \
    (Static Assets) /                    \ (Dynamic /api/*)
                   ▼                  ▼
             [ S3 Bucket ]     [ Application Load Balancer ]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                 [ EC2 Instance 1 ]        [ EC2 Instance 2 ]
                 (In Auto Scaling Group - min 2, max 6)
                         │                         │
                         ├─────────────────────────┤
                         ▼                         ▼
               [ Amazon RDS (MySQL) ]   [ Amazon ElastiCache ]
                 (Multi-AZ Replica)        (Session State)
```

### Network Topology & Traffic Flow
*   **Edge Routing**: Users access the platform via the **Amazon CloudFront CDN**. Static content requests (HTML, JS, CSS, images) are intercepted at the edge and served directly from an **Amazon S3** bucket using **Origin Access Control (OAC)** to ensure private access.
*   **Dynamic API Layer**: Dynamic requests (`/api/*`) are forwarded to an **Application Load Balancer (ALB)**, which distributes connections to active instances inside an **Auto Scaling Group (ASG)**.
*   **Private Compute Layer**: Web servers run on `t3.micro` EC2 instances hosted in isolated **Private App Subnets** across two Availability Zones (`us-east-1a` and `us-east-1b`). Outbound internet traffic for package installation is routed through a **NAT Gateway**.
*   **Stateless Data Tier**: State is kept completely external to the servers to support seamless scaling. Query caching and transient data are managed via **Amazon ElastiCache Redis**, and relational product/user records reside in an **Amazon RDS MySQL** instance configured with a Multi-AZ replica.

---

## 2. Directory Structure

The repository is modularly structured, separating application logic, infrastructure declarations, and database schemas:

*   **`.github/`**: Houses automated CI/CD configurations (GitHub Actions) for linting codes and building docker images.
*   **`backend/`**: Node.js and Express server routing application. Contains business endpoints, database queries, and AWS SDK integrations.
*   **`database/`**: Contains raw SQL schemas (`schema.sql`) and data seeds (`seed.sql`) to prepare database instances.
*   **`docker/`**: Houses Dockerfiles (`backend.Dockerfile`, `frontend.Dockerfile`) for containerized deployment, alongside an Nginx configuration (`nginx.conf`).
*   **`frontend/`**: Single Page Application built using React, TypeScript, and Vite. Displays catalog inventory, cart checkouts, and an admin panel, alongside a telemetry dashboard.
*   **`terraform/`**: Fully configured Infrastructure-as-Code modules declaring the AWS environment (VPC, CloudFront, ALB, ASG, RDS, ElastiCache, Secrets Manager, and IAM roles).

---

## 3. Core Engineering Features & Fallback Design

One of the application's most powerful architectural features is its ability to run seamlessly in different environments using local mock-ups when AWS services are unavailable.

### A. Zero-Dependency Database Fallback
In `backend/config/db.js`, the app initializes a connection pool to MySQL. If the database host is unreachable (e.g., during local development or network splits), it automatically intercepts SQL queries and falls back to a **Zero-Dependency In-Memory SQL Simulator**.
*   **How it works**: A custom JavaScript function parses SQL keywords (e.g. `SELECT`, `INSERT`, `UPDATE`, `JOIN`) and manipulates local memory arrays.
*   **Impact**: Allows the application to be tested locally immediately using `node_modules` or Docker Compose without installing MySQL.

### B. Dual-Mode Upload Pipeline
The file-upload configurations inside `backend/config/s3.js` check for S3 credentials or IAM instance role details at runtime:
*   **AWS Mode**: Uploads files directly to the designated **S3 Bucket** using the AWS SDK and memory buffers.
*   **Local Fallback**: Writes files to a local directory (`./uploads`) and serves them statically via Express.

### C. CPU-Stress Simulation Engine
To demonstrate Auto-Scaling during presentations, `backend/routes/metrics.js` exposes a CPU stress route (`/api/metrics/cpu-spike`):
*   **Mechanism**: A non-blocking busy loop runs calculations for 80ms and then yields to the Express event loop for 20ms using `setTimeout`.
*   **Advantage**: This generates an artificial CPU usage spike (~85%) which triggers CloudWatch scaling alarms, without locking the main thread or causing server crashes.

---

## 4. Infrastructure-as-Code (Terraform) Blueprint

The AWS infrastructure is fully declared in Terraform files:

*   **`main.tf`**: Configures the core VPC, multi-AZ private/public subnets, route tables, and NAT Gateways.
*   **`security_groups.tf`**: Sets up strict firewall rules:
    *   ALB security group allows public 80/443 ingress.
    *   EC2 web server security group only accepts ingress from the ALB security group.
    *   RDS and Redis security groups only accept traffic from the EC2 web servers.
*   **`autoscaling.tf`**: Outlines the Auto Scaling Group:
    *   **Target Tracking Policy**: Automatically scales instances to maintain average CPU usage at **60.0%**.
    *   **Warm Pools**: Pre-initialized, stopped instances are kept in a warm pool. During a scale-out event, instances boot in seconds rather than minutes, cutting scaling latency by up to 80%.
*   **`cloudfront.tf` & `s3.tf`**: Configures CDN distribution pointing to S3 (origin bucket for static files), locked down with Origin Access Control (OAC).
*   **`rds.tf` & `elasticache.tf`**: Declares MySQL database clusters (Multi-AZ) and Redis caching networks.

---

## 5. Software Implementation Details

### Backend Server (`backend/server.js`)
*   Bootstraps Express with JSON and URL-encoded parsers.
*   Utilizes modular routing for authorization (`/api/auth`), products (`/api/products`), orders (`/api/orders`), metrics (`/api/metrics`), and file uploads (`/api/upload`).
*   Serves the compiled React frontend static files as a fallback route for single-page routing (`*`).

### Frontend Client (`frontend/src/`)
*   **`App.tsx`**: Sets up paths and routes using React Router.
*   **`views/AutoscalingTelemetry.tsx`**: A dashboard visualizing real-time instance statistics. It polls the server metrics, logs CPU spikes, and maps the scaling statuses.
*   **`views/Catalog.tsx` & `views/Cart.tsx`**: Provides fully interactive catalog lists and checkout pipelines.

---

## 6. Telemetry & 4-Phase Scale Walkthrough

To demonstrate elastic behavior in real-time, the frontend includes a custom **Telemetry Monitor** illustrating a 4-phase load progression:

```text
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │ 1. Baseline     │  ──>  │ 2. Load Inject  │  ──>  │ 3. CW Alarm     │  ──>  │ 4. Rebalance    │
 │ 2 Healthy Nodes │       │ CPU Spike to 85%│       │ ASG +1 Node     │       │ Load Stabilized │
 │ CPU < 10%       │       │ Simulated API   │       │ Warm Pool Boot  │       │ Scaling Cool    │
 └─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1.  **Baseline Phase**: The system runs at rest, with 2 healthy instances in the target group and CPU load at <10%.
2.  **Load Injection**: Admin triggers the CPU-spike endpoint. CPU utilization is artificially raised to ~85%.
3.  **Alarm Triggering**: CloudWatch notices average CPU has crossed the 60% target. An alarm transitions to `ALARM` state, signaling the ASG to scale out.
4.  **Rebalance**: The ASG pulls a pre-initialized node from the **Warm Pool**. Once it passes the ALB health checks (`/api/metrics/health`), the load balancer redirects incoming requests, distributing the load and bringing the average CPU back down.

---

## 7. CI/CD Deployment Pipelines

The repository includes a GitHub Actions configuration in `.github/workflows/deploy.yml`:
*   **Linting**: Runs quality checks across backend and frontend directories to enforce coding guidelines.
*   **Build**: Compiles the React SPA, verifying TypeScript types and syntax.
*   **Containerization**: Builds multi-stage Docker images for backend and frontend components, preparing them for publication to Amazon ECR (Elastic Container Registry) for rolling EC2 updates.

---

## 8. Conclusion & Recommendations

The application demonstrates strong cloud architecture patterns:
1.  **State Decoupling**: Offloading state storage to RDS MySQL and Redis caching enables compute instances to be terminated or scaled-out on demand.
2.  **Edge Offloading**: By caching static layouts inside S3 via CloudFront CDN, server compute resources are reserved solely for handling dynamic business logic.
3.  **Cost and Speed Optimization**: Integrating ASG Warm Pools protects against rapid traffic spikes while keeping infrastructure expenditures lean during off-peak hours.

**Recommended Practices**:
*   To minimize AWS costs during testing, ensure all resources are torn down using `terraform destroy -auto-approve` immediately after evaluation.
*   For production configurations, rotate DB secrets in AWS Secrets Manager on a regular schedule using lambda triggers.
