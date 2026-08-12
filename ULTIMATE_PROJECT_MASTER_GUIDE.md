# 🏆 ULTIMATE PROJECT MASTER GUIDE: AutoScale AWS E-Commerce Platform

---

## 📚 TABLE OF CONTENTS
1. [Executive Summary & 30-Second Viva Pitch](#1-executive-summary--30-second-viva-pitch)
2. [High-Level AWS Architecture & Service Breakdown](#2-high-level-aws-architecture--service-breakdown)
3. [Application Stack & Dependency Versions](#3-application-stack--dependency-versions)
4. [Core Algorithms & Technical Logic](#4-core-algorithms--technical-logic)
5. [Database Schema & ER Model](#5-database-schema--er-model)
6. [Network Security Groups & Firewall Architecture](#6-network-security-groups--firewall-architecture)
7. [Session Management: Stateless JWT vs ElastiCache Redis](#7-session-management-stateless-jwt-vs-elasticache-redis)
8. [Docker Multi-Container Architecture](#8-docker-multi-container-architecture)
9. [Logging, Monitoring & Diagnostics Strategy](#9-logging-monitoring--diagnostics-strategy)
10. [The 5 Most Important Code Snippets Explained](#10-the-5-most-important-code-snippets-explained)
11. [Top Questions Teachers Ask & Model Answers](#11-top-questions-teachers-ask--model-answers)
12. [Step-by-Step Live Presentation Guide](#12-step-by-step-live-presentation-guide)

---

## 1. 🎙️ Executive Summary & 30-Second Viva Pitch

> *"Our project is an **Enterprise E-Commerce Platform** hosted on **Amazon Web Services (AWS)** using **Terraform**. Its main highlight is **Auto-Scaling**: when thousands of users visit the website at the same time, AWS automatically creates new virtual servers (EC2 instances) to handle the traffic. When traffic drops, it deletes the extra servers to save money. We also built a **Real-Time Telemetry Dashboard** with a traffic load injector to prove that Auto-Scaling works live during our presentation."*

---

## 2. ☁️ High-Level AWS Architecture & Service Breakdown

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

### **AWS Cloud Services Table**:

| Service | How it is Used | Why it is Used | When it is Used |
| :--- | :--- | :--- | :--- |
| **Amazon VPC & Subnets** | Multi-AZ network containing 2 Public Subnets (ALB/NAT), 2 Private App Subnets (EC2 ASG), and 2 Private DB Subnets (RDS/Redis). | Enforces strict network isolation and security compliance by keeping application and database servers off the public internet. | Continuously routes all internal and external network traffic. |
| **AWS CloudFront** | Global Content Delivery Network (CDN) acting as the main entrypoint (`d1lcl49p25nd33.cloudfront.net`). | Caches static assets globally, enforces HTTPS/TLS encryption, and mitigates DDoS attacks. | Invoked on every user request from web browsers. |
| **AWS Load Balancer (ALB)** | Layer 7 load balancer (`cloudscale-alb-1680039259.us-east-1.elb.amazonaws.com`). | Distributes incoming HTTP requests evenly across healthy EC2 instances and performs active health checks (`/api/metrics/health`). | Receives traffic forwarded from CloudFront on every request. |
| **AWS EC2 Auto Scaling (ASG)** | Dynamic fleet of Ubuntu EC2 instances running Node.js + React. | Automatically provisions or terminates instances based on CPU demand (scales between 1 and 6 instances). | Monitors load 24/7; scales out when average CPU exceeds 60%. |
| **Amazon RDS (MySQL)** | Managed MySQL 8.0 database engine in private subnets (`cloudscale-rds-mysql.co1ga4ym0qcm.us-east-1.rds.amazonaws.com`). | Stores relational data (users, catalog products, purchase orders, line items). | Executed during user auth, product searches, and order checkouts. |
| **Amazon ElastiCache (Redis)** | In-memory Redis cluster (`cloudscale-session-redis`). | Caches user session state and frequent queries to offload MySQL database pressure. | Queried during active user sessions and cart updates. |
| **Amazon S3** | Object storage bucket (`cloudscale-assets-6925e952`). | Stores product photography assets durably without consuming EC2 disk space. | Accessed when uploading new products or rendering catalog media. |
| **AWS Secrets Manager** | Encrypted secret manager (`cloudscale-db-secret-6925e952`). | Eliminates hardcoded database passwords from source code. | Queried by EC2 nodes during bootstrap execution. |
| **AWS IAM Instance Profiles** | IAM Role (`cloudscale-ec2-s3-role`) attached to EC2 instances. | Enables **Keyless Authentication** so Node.js AWS SDK calls use temporary IAM credentials automatically. | Evaluated whenever EC2 instances interact with S3 or Secrets Manager. |

---

## 3. 📦 Application Stack & Dependency Versions

### **Backend Stack (`backend/package.json`)**
- **Node.js**: `v24.18.1` (Server Runtime)
- **Express.js**: `v4.18.2` (Web Framework)
- **mysql2**: `v3.9.1` (MySQL Database Driver with Connection Pooling)
- **ioredis**: `v5.3.2` (Async Redis Client)
- **@aws-sdk/client-s3**: `v3.525.0` (AWS S3 Operations)
- **@aws-sdk/client-cloudfront**: `v3.525.0` (CloudFront Cache Invalidation)
- **jsonwebtoken**: `v9.0.2` (JWT Token Signing & Verification)
- **bcryptjs**: `v2.4.3` (Salted Password Hashing)
- **multer**: `v1.4.5` (Multipart Image Upload Handling)

### **Frontend Stack (`frontend/package.json`)**
- **React**: `v18.2.0` (UI Component Library)
- **TypeScript**: `v5.2.2` (Static Typing)
- **Vite**: `v5.4.21` (Fast Frontend Compiler)
- **lucide-react**: `v0.344.0` (Vector Icons)
- **recharts**: `v2.12.2` (Real-Time Auto-Scaling Metrics & Telemetry Graphs)

### **Infrastructure as Code**
- **HashiCorp Terraform**: `v1.15.8` (AWS Infrastructure Provisioning)

---

## 4. 🧮 Core Algorithms & Technical Logic

### **A. Target Tracking Auto-Scaling Algorithm**
- **Metric**: Target CPU Utilization = **`60.0%`**.
- **Calculated Scaling Logic**:
  $$\text{New Capacity} = \left\lceil \text{Current Capacity} \times \frac{\text{Current Metric}}{\text{Target Metric}} \right\rceil$$
  When CloudWatch detects CPU exceeding 60% for 3 consecutive minutes, ASG provisions pre-initialized EC2 nodes into the target group.

### **B. Keyless Credential Provider Chain Algorithm**
- **Local Dev**: Reads credentials from `backend/.env`.
- **Cloud EC2**: Omits hardcoded access keys. The AWS SDK falls back down the provider chain:
  $$\text{Environment Vars} \longrightarrow \text{SSO Credentials} \longrightarrow \text{EC2 IMDSv2 Metadata} \longrightarrow \text{IAM Instance Profile}$$
  EC2 nodes fetch temporary security credentials from IMDSv2 (`http://169.254.169.254/latest/meta-data/`).

### **C. Automated S3 Media Asset Sync Algorithm (`backend/server.js`)**
Upon Express server startup, Node.js checks if `backend/uploads/` exists locally. If any of the 8 product images (`spectre_laptop.jpg`, `acoustic_headphones.jpg`, etc.) are missing, it automatically fetches them from `s3://cloudscale-assets-6925e952/uploads/` via `@aws-sdk/client-s3`.

### **D. Zero-Dependency In-Memory SQL Simulator (`backend/config/db.js`)**
If local MySQL is unreachable, `pool.getConnection()` catches the error and activates a zero-dependency in-memory SQL engine that parses regex patterns for offline testing.

### **E. Transactional Checkout & Inventory Deduction (`backend/routes/orders.js`)**
Executes SQL transactions (`START TRANSACTION` ... `COMMIT` / `ROLLBACK`) with `SELECT ... FOR UPDATE` row locking to guarantee atomicity and prevent race conditions during peak traffic checkout operations.

---

## 5. 🗄️ Database Schema & ER Model (`database/schema.sql`)

```text
  ┌─────────────────┐             ┌─────────────────┐
  │      users      │             │    products     │
  ├─────────────────┤             ├─────────────────┤
  │ id (PK)         │             │ id (PK)         │
  │ name            │             │ name            │
  │ email (UNIQUE)  │             │ description     │
  │ password_hash   │             │ price           │
  │ role            │             │ image_url       │
  │ created_at      │             │ category (INDEX)│
  └────────┬────────┘             │ stock           │
           │ 1                    └────────┬────────┘
           │                               │ 1
           │ N                             │
  ┌────────┴────────┐             ┌────────┴────────┐
  │     orders      │             │   order_items   │
  ├─────────────────┤             ├─────────────────┤
  │ id (PK)         │             │ id (PK)         │
  │ user_id (FK) ───┼───────────N │ order_id (FK)   │
  │ total_amount    │ 1         N │ product_id (FK) │
  │ status          │             │ quantity        │
  │ created_at      │             │ unit_price      │
  └─────────────────┘             └─────────────────┘
```
- **`users`**: Stores salted bcrypt password hashes (`password_hash`).
- **`products`**: `category` column is indexed (`idx_category`) for fast filtering.
- **`orders`**: Linked to `users.id` via foreign key with `ON DELETE CASCADE`.
- **`order_items`**: Junction table mapping orders to purchased line items.

---

## 6. 🛡️ Network Security Groups & Firewall Architecture

```text
  [ Internet (0.0.0.0/0) ]
             │
             │ Inbound: Port 80 / 443
             ▼
  ┌───────────────────────────┐
  │  ALB Security Group       │  (Public Inbound Access)
  └─────────────┬─────────────┘
                │
                │ Inbound: Port 5000 (ONLY from ALB SG)
                ▼
  ┌───────────────────────────┐
  │  EC2 Web Server SG        │  (Private App Subnets)
  └──────┬─────────────────┬──┘
         │                 │
         │ Port 3306       │ Port 6379
         │ (ONLY Web SG)   │ (ONLY Web SG)
         ▼                 ▼
  ┌───────────────┐   ┌────────────────┐
  │ RDS MySQL SG  │   │ Redis Cache SG │
  └───────────────┘   └────────────────┘
```
- **ALB SG**: Accepts traffic from `0.0.0.0/0` (public internet).
- **EC2 Web Server SG**: Blocks public traffic; accepts port 5000 **ONLY** from the ALB Security Group ID.
- **RDS Database SG**: Blocks public traffic; accepts port 3306 **ONLY** from the EC2 Web Server Security Group ID.
- **ElastiCache Redis SG**: Blocks public traffic; accepts port 6379 **ONLY** from the EC2 Web Server Security Group ID.

---

## 7. 🔑 Session Management: Stateless JWT vs ElastiCache Redis

- **Stateless JWT**: Eliminates ALB "Sticky Sessions". Any EC2 node in the Auto Scaling Group can verify incoming user requests independently via `JWT_SECRET`.
- **ElastiCache Redis**: Used for token blacklisting, rate limiting, and caching catalog queries to reduce MySQL read latency during high traffic spikes.

---

## 8. 🚢 Docker Multi-Container Architecture (`docker-compose.yml`)

For local testing without AWS, Docker Compose spins up 3 containerized services:
1. **`db`**: MySQL 8.0 initialized with `schema.sql` and `seed.sql`.
2. **`backend`**: Node.js Express REST API connected to containerized MySQL.
3. **`frontend`**: Nginx container serving compiled React SPA and proxying `/api/*` requests.

---

## 9. 📊 Logging, Monitoring & Diagnostics Strategy

1. **CloudWatch Alarm Logs**: Records scaling activities, threshold breaches, and target group registration events.
2. **EC2 Bootstrap Log (`/var/log/user-data.log`)**: Logs shell output from instance initialization scripts.
3. **PM2 Process Logs**: Captures application console output, HTTP request logs, and uncaught exceptions on EC2 nodes.
4. **Health Check Telemetry**: ALB continuously pings `GET /api/metrics/health` (`200 OK`) to verify node health.

---

## 10. 🔍 The 5 Most Important Code Snippets Explained

### **Snippet 1: Auto-Scaling Policy (`terraform/autoscaling.tf`)**
```hcl
resource "aws_autoscaling_policy" "cpu_target_tracking" {
  name                   = "cloudscale-cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.web_asg.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0 # Scales out when average CPU load exceeds 60%
  }
}
```
**Explanation**: Sets a target threshold of **60% CPU load**. If traffic spikes and average CPU load goes above 60%, AWS automatically provisions new EC2 instances to balance the workload.

---

### **Snippet 2: Keyless AWS Security (`backend/config/s3.js`)**
```javascript
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
});
```
**Explanation**: We do NOT hardcode secret access keys on production servers. On AWS EC2, the SDK automatically fetches temporary credentials from the attached IAM Instance Profile (`cloudscale-web-instance-profile`).

---

### **Snippet 3: Automated S3 Image Downloader (`backend/server.js`)**
```javascript
const syncProductAssets = async () => {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) return;

  for (const img of productImages) {
    const localPath = path.join(uploadsDir, img);
    if (!fs.existsSync(localPath)) {
      const command = new GetObjectCommand({ Bucket: bucket, Key: `uploads/${img}` });
      const data = await s3.send(command);
      fs.writeFileSync(localPath, Buffer.from(await data.Body.transformToByteArray()));
    }
  }
};
```
**Explanation**: When a new EC2 server is booted by the Auto Scaling Group, `server.js` checks if product photos exist locally. If missing, it automatically downloads all 8 product images from the S3 bucket.

---

### **Snippet 4: Transactional Checkout & Stock Locking (`backend/routes/orders.js`)**
```javascript
await connection.query('START TRANSACTION');

const [products] = await connection.query(
  'SELECT stock FROM products WHERE id = ? FOR UPDATE',
  [item.product_id]
);

if (products[0].stock < item.quantity) {
  await connection.query('ROLLBACK');
  return res.status(400).json({ message: 'Insufficient stock' });
}

await connection.query(
  'UPDATE products SET stock = stock - ? WHERE id = ?',
  [item.quantity, item.product_id]
);

await connection.query('COMMIT');
```
**Explanation**: Uses SQL Transactions with `FOR UPDATE` row locking to lock the database row while reading and updating stock, guaranteeing atomicity and preventing overselling.

---

### **Snippet 5: In-Memory SQL Simulator Fallback (`backend/config/db.js`)**
```javascript
try {
  const connection = await pool.getConnection();
  console.log('[Database] Connected to MySQL successfully!');
} catch (err) {
  console.warn('[Database Fallback] Launching Zero-Dependency In-Memory SQL Simulator');
  useMockDb = true;
}
```
**Explanation**: If a developer tests the app locally without installing MySQL, the backend automatically falls back to an in-memory SQL simulator so the application runs smoothly offline.

---

## 11. 🎯 Top Questions Teachers Ask & Model Answers

1. **Q: Why did you use Terraform instead of creating resources manually in the AWS Console?**
   - **Answer**: Terraform is **Infrastructure as Code (IaC)**. It allows us to write our cloud architecture in declarative files (`.tf`), making infrastructure version-controlled, repeatable, and deployable with a single command (`terraform apply`).

2. **Q: What is CloudFront and why is it placed in front of the Load Balancer?**
   - **Answer**: CloudFront is a Content Delivery Network (CDN) with global edge locations. Placing it in front of the Load Balancer caches website assets closer to users, speeds up response times, and protects the backend from DDoS attacks.

3. **Q: How does the application prevent secret credential leaks to GitHub?**
   - **Answer**: All local credentials are stored in `backend/.env`, which is listed in `.gitignore`. For production EC2 instances, we use AWS IAM Instance Profiles, meaning zero secrets exist in our source code repository.

4. **Q: How can you demonstrate Auto-Scaling live?**
   - **Answer**: We built an **Autoscaling Telemetry Dashboard** with a **Load Injector Button**. Clicking it generates heavy CPU load on the backend, crossing the 60% threshold and triggering AWS to spawn a new server live.

---

## 12. 🚀 Step-by-Step Live Presentation Guide

1. **Step 1**: Open [http://d1lcl49p25nd33.cloudfront.net](http://d1lcl49p25nd33.cloudfront.net) in your browser. Show the **Product Catalog** with images, category filters, and search bar.
2. **Step 2**: Add items to cart and perform a checkout to demonstrate database transaction and inventory deduction.
3. **Step 3**: Click the **Telemetry Monitor** tab. Show the 2 active healthy server nodes operating at ~5% CPU.
4. **Step 4**: Click **"Inject High Traffic Load"**. Show the real-time graph rising above 60%, demonstrating CloudWatch triggering an EC2 scale-out event!
