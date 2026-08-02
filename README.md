# Enterprise-Grade Auto-Scaling E-Commerce Cluster (AWS Showcase)

This repository contains a production-grade blueprint for a highly available, load-balanced, and elastically scaled Online Shopping Web Application on Amazon Web Services (AWS). 

---

## 1. Refined Architecture Design

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

---

## 2. Directory Layout

```text
AutoScalingProject/
├── .github/               # CI/CD GitHub Actions workflows for linting and ECR builds
├── backend/               # Node/Express REST API (auth, metrics, database configs)
├── database/              # MySQL schema (schema.sql) and seed scripts (seed.sql)
├── docker/                # Multi-stage Dockerfiles and Nginx routing proxy configs
├── frontend/              # React SPA (telemetry dashboard, catalog, cart, admin)
├── terraform/             # VPC, CloudFront OAC, ALB, RDS, ElastiCache, S3, ASG & IAM IaC
├── docker-compose.yml     # local multi-container spin-up descriptor
└── README.md              # Project guides and walkthrough
```

---

## 3. Local Installation & Startup

### Option A: Docker Compose (Zero Configuration)
To spin up the entire cluster (MySQL Database + Backend API + Nginx Frontend proxy) locally:
```bash
docker-compose up --build
```
Access the application at `http://localhost:3000`. The database seeds automatically run on initial container startup.

### Option B: Node.js Dev Run
1.  **Database**: Setup a local MySQL instance with a database named `ecommerce_db` and execute the SQL scripts in `./database/`.
2.  **Environment**: Adjust `./backend/.env` to configure db connections.
3.  **Launch**:
    *   **Backend**: `cd backend && npm install && npm run dev` (Runs on port 5000)
    *   **Frontend**: `cd frontend && npm install && npm run dev` (Runs on port 3000)

---

## 4. Deploying to AWS (Terraform)

Deploy the entire infrastructure to AWS:
1.  Ensure you have active AWS credentials configured via the AWS CLI.
2.  Initialize and validate the Terraform workspace:
    ```bash
    cd terraform
    terraform init
    terraform plan
    ```
3.  Deploy:
    ```bash
    terraform apply -auto-approve
    ```
4.  Once completed, copy the **`cloudfront_domain_name`** output to access the website via global edge.

---

## 5. Performing the 4-Phase Presentation Walkthrough

Open the website domain, navigate to the **Telemetry Monitor** tab, and execute the demonstration:

1.  **Phase 1: Baseline State**
    *   Verify that **2 Healthy Instances** exist in the target group.
    *   Observe low CPU load average (~5%) and constant health checks.
2.  **Phase 2: Load Injection**
    *   Click **"Inject High Traffic Load"** on the dashboard.
    *   The API triggers stress tasks, simulating heavy user traffic.
3.  **Phase 3: Alarm & Scale Out**
    *   Watch the CPU utilization cross the **60.0% target tracking threshold**.
    *   Observe the terminal logs showing the CloudWatch alarm triggering a scale-out event.
    *   ASG immediately boots a pre-initialized stopped instance from the **Warm Pool** to join the active target fleet.
4.  **Phase 4: Rebalance & Validation**
    *   The new node passes health checks (`200 OK` on `/api/metrics/health`) and begins processing requests.
    *   Average CPU load drops, stabilizing the cluster.
    *   Click **"Stop Traffic Generation"** to cool down and watch the scale-in terminate the extra instance.

---

## 6. Cleanup & Cost Prevention

To avoid ongoing AWS charges (especially for ALB and CloudFront):
```bash
cd terraform
terraform destroy -auto-approve
```
