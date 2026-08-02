# Systems Engineering Report: Enterprise-Grade Elastic E-Commerce Architecture on AWS

---

## Table of Contents
1.  **Executive Summary**
2.  **Enterprise Traffic Path & Edge Layer (VPC, Subnets, CloudFront)**
3.  **Security & Secret Privilege Boundaries (Secrets Manager, IAM, SGs)**
4.  **Load Balancing & Target Health Checking**
5.  **State Management & Caching Tier (ElastiCache Redis)**
6.  **ASG Elasticity, Warm Pools & Target Tracking**
7.  **Software Implementation & CI/CD Pipelines**
8.  **The 4-Phase Presentation Walkthrough**
9.  **AWS Free Tier Cost Assessment & Resource Cleanup**
10. **Team Organization & Division of Labor**

---

## 1. Executive Summary

Modern web applications require architectures that are resilient, cost-effective, and fast. Running static server fleets results in either **oversizing** (incurring idle resource costs) or **undersizing** (leading to request drops and service outages).

This project implements an **Enterprise-Grade Elastic E-Commerce Cluster** on AWS. It uses an **Amazon CloudFront CDN** to distribute static React frontend files from a secure, private **Amazon S3** bucket to edge locations globally, minimizing latency and server load. Dynamic API requests are routed directly to an **Application Load Balancer (ALB)**, which load-balances traffic across private EC2 compute instances managed by an **Auto Scaling Group (ASG)**. State is decoupled using **Amazon RDS MySQL** configured for Multi-AZ resiliency and **Amazon ElastiCache Redis** for distributed sessions. Scaling is managed using **ASG Target Tracking** and **Warm Pools**, ensuring rapid response times during sudden traffic spikes.

---

## 2. Enterprise Traffic Path & Edge Layer

The network topology is split into Edge and Internal VPC layers:

```
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

### Network Topology Details
*   **VPC (10.0.0.0/16)**: Multi-AZ spanning `us-east-1a` and `us-east-1b`.
*   **Edge (CloudFront)**: Resolves requests at the edge.
    *   **Static Assets (`/` default behavior)**: Served directly from a private **S3 Bucket** via **Origin Access Control (OAC)**. No static traffic ever hits the EC2 servers.
    *   **Dynamic API Traffic (`/api/*` behavior)**: Forwarded to the ALB. Headers, cookies, and query strings are passed through without caching.
*   **Private App Subnets (10.0.10.0/24 & 10.0.11.0/24)**: Host the EC2 servers. EC2 servers are completely isolated, using a **NAT Gateway** for outbound internet requests (e.g. cloning Git, npm installs).
*   **Private DB Subnets (10.0.20.0/24 & 10.0.21.0/24)**: Host Multi-AZ RDS and ElastiCache Redis. Totally blockaded from the public internet.

---

## 3. Security & Secret Privilege Boundaries

### AWS Secrets Manager Integration
We eliminate hardcoded database credentials by utilizing **AWS Secrets Manager**. 
1.  A random, secure password is generated at deploy time.
2.  Credentials (username, password, database host endpoint) are stored as a JSON object in Secrets Manager.
3.  Each EC2 instance uses an **IAM Instance Profile** role (`cloudscale-ec2-s3-role`) allowing it to query Secrets Manager securely at boot. The user-data script queries the secret dynamically, extracts the parameters, and writes the local `.env` configuration.

### Security Group Rule Matrix
*   **ALB SG**: Ingress 80/443 open to `0.0.0.0/0`.
*   **Web Server SG**: Ingress 5000/3000 restricted to **ALB SG ID**. Ingress 22 (SSH) open strictly to **Administrator IP**.
*   **DB Server SG**: Ingress 3306 (MySQL) restricted to **Web Server SG ID**.
*   **Redis SG**: Ingress 6379 (Redis) restricted to **Web Server SG ID**.

---

## 4. Load Balancing & Target Health Checking

The ALB evaluates instance health via HTTP requests:
*   **Endpoint**: `/api/metrics/health` (Port 5000)
*   **Success Interval**: 15 seconds. If a target fails 3 consecutive checks, it is deregistered, and the ALB stops routing traffic to it.

---

## 5. State Management & Caching Tier (ElastiCache Redis)

To keep the application tier **fully stateless** (permitting instant node termination during scale-in without user session loss):
*   Authentication is handled via stateless **JWT Tokens** decoded on-demand.
*   Shopping carts are maintained on the client-side (`sessionStorage`) and synchronized with MySQL at checkout.
*   **Amazon ElastiCache Redis** is deployed to handle centralized database query cache queries and session tokens, drastically cutting database read loads and speeding up server response times.

---

## 6. ASG Elasticity, Warm Pools & Target Tracking

### Target Tracking Scaling Policy
Instead of simple high/low alarms, we implement a **Target Tracking Policy** set to keep average CPU utilization at **60.0%** (`ASGAverageCPUUtilization`). CloudWatch dynamically scales the cluster up or down to maintain this load line.

### ASG Warm Pools
Bootstrapping an instance (installing OS packages, cloning repositories, compiling Vite assets) can take several minutes. We enable **AWS Auto Scaling Warm Pools**:
*   Pre-initialized instances are created and placed in a `Stopped` state.
*   When a scaling event occurs, a pre-warmed instance is booted and joins the ALB target group in seconds.
*   This cuts the scale-out latency by over 80%.

---

## 7. Software Implementation & CI/CD Pipelines

*   **Express Backend**: Manages routes and connects to RDS and ElastiCache. Serves the precompiled React client statically as a fallback.
*   **React Frontend**: Telemetry screen visualizes real-time scaling events, logs, and server stats.
*   **GitHub Actions (`deploy.yml`)**: Automates Terraform syntax checks, format rules, runs frontend builds, and compiles Docker images for rolling cluster deployments.

---

## 8. The 4-Phase Presentation Walkthrough

Demonstrate the high-availability and auto-scaling sequence using the **Telemetry Monitor** tab:

```
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │ 1. Baseline     │  ──>  │ 2. Load Injection│  ──>  │ 3. CloudWatch   │  ──>  │ 4. Rebalance    │
 │ 2 Healthy Nodes │       │ Synthetic CPU   │       │ Alarm & Scale   │       │ Healthy Target  │
 │ CPU < 10%       │       │ Spike to 95%    │       │ ASG +1 Node     │       │ Distribution    │
 └─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1.  **Phase 1: Baseline State** (1-2 minutes)
    *   Open the Telemetry screen. Highlight the status showing **2 Healthy instances** inside the ALB Target Group.
    *   Point out average CPU load hovering below 10%, with constant healthy health checks.
2.  **Phase 2: Load Injection**
    *   Click **"Inject High Traffic Load"**.
    *   Explain that the backend executes an asynchronous CPU-intensive task to simulate heavy concurrent load (similar to a flash sale spike).
3.  **Phase 3: Alarm & Scale Out**
    *   Observe the CPU load indicator climb past the **60% threshold**.
    *   Show the simulated CloudWatch logs terminal: the alarm transitions to `ALARM` state, and the ASG initiates a launch request for a new node.
    *   Explain that the ASG immediately pulls a pre-initialized node from the **Warm Pool** to fulfill the request.
4.  **Phase 4: Rebalance & Validation**
    *   Watch the new instance transition to `Healthy` in the target group.
    *   Demonstrate that the ALB begins routing traffic to the new instance (requests count rises on Node 3). The average CPU load drops, stabilizing the cluster.
    *   Click **"Stop Traffic Generation"** to cool down and watch the scale-in terminate the extra instance.

---

## 9. AWS Free Tier Cost Assessment & Resource Cleanup

To stay within the AWS Free Tier:
*   Use `t3.micro` sizes for EC2 instances and `db.t3.micro` for RDS.
*   Use a single-node `cache.t3.micro` for ElastiCache Redis.

> [!CAUTION]
> CloudFront and Application Load Balancers can accumulate small hourly charges outside the Free Tier.
> Run **`terraform destroy -auto-approve`** in the `terraform/` directory when testing is complete to tear down all resources and avoid billing.

---

## 10. Team Organization & Division of Labor

```
Member 1: Frontend Developer (React Telemetry interface, Catalog & Cart Views)
Member 2: Backend API Architect (Auth, Product uploads, System Metrics & Stress controllers)
Member 3: Database & Cache Specialist (Multi-AZ RDS MySQL, ElastiCache Redis & Secrets Manager)
Member 4: DevOps & IaC Engineer (CloudFront CDN, ALB Routing, Target Tracking ASG, Warm Pools)
Member 5: QA & Integration Engineer (CI/CD GitHub Actions, Apache Benchmark, presentation checks)
```
