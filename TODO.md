# Production Hardening & Deployment Guide

This document outlines the steps required to transform this multi-container application from a development/learning project into a production-ready, secure, and scalable system.

## Table of Contents
1. [Infrastructure & Architecture](#infrastructure--architecture)
2. [Security Hardening](#security-hardening)
3. [Database & Data Management](#database--data-management)
4. [Monitoring & Observability](#monitoring--observability)
5. [Performance & Scalability](#performance--scalability)
6. [CI/CD Improvements](#cicd-improvements)
7. [Disaster Recovery & Business Continuity](#disaster-recovery--business-continuity)
8. [Cost Optimization](#cost-optimization)
9. [Compliance & Governance](#compliance--governance)

---

## Infrastructure & Architecture

### 1. Move to Managed Services
**Current:** ✅ **COMPLETED** - Using AWS RDS PostgreSQL and AWS ElastiCache Redis  
**Status:** Production-ready managed database and cache services deployed

#### PostgreSQL → Amazon RDS ✅ DONE
- **Why:** Automated backups, point-in-time recovery, high availability, automatic failover
- **Completed:**
  - ✅ RDS PostgreSQL instance created
  - ✅ Endpoint: `multi-container-app.cluster-c50c0iw6eu3o.us-east-1.rds.amazonaws.com`
  - ✅ Updated `docker-compose.prod.yml` to use RDS endpoint
  - ✅ Removed containerized postgres service from production compose
  - ✅ Password stored in EB environment properties
  
- **Next steps for production hardening:**
  - [ ] Enable Multi-AZ deployment for high availability
  - [ ] Configure automated backups (7-35 day retention)
  - [ ] Enable encryption at rest
  - [ ] Move to private subnet (currently accessible for setup)
  - [ ] Upgrade instance: db.t3.small minimum (currently db.t3.micro)
  - [ ] Move password from EB env to Secrets Manager

#### Redis → Amazon ElastiCache ✅ DONE
- **Why:** Automatic failover, snapshots, read replicas
- **Completed:**
  - ✅ ElastiCache Serverless Redis created
  - ✅ Endpoint: `multi-container-app-dh0bpf.serverless.use1.cache.amazonaws.com:6379`
  - ✅ Updated `docker-compose.prod.yml` to use ElastiCache endpoint
  - ✅ Removed containerized redis service from production compose
  
- **Next steps for production hardening:**
  - [ ] Move to private subnet
  - [ ] Enable automatic backups
  - [ ] Configure monitoring and alarms

### 2. Load Balancing & High Availability
**Current:** Single EB instance  
**Production:** Multi-AZ with auto-scaling

- Enable EB auto-scaling:
  - Min instances: 2
  - Max instances: 10
  - Scaling triggers: CPU > 70% or RequestCount
- Deploy across multiple availability zones
- Use Application Load Balancer (ALB) with health checks
- Configure health check endpoint in your API (`/health`)

### 3. Network Architecture
- **VPC Setup:**
  - Public subnets: ALB only
  - Private subnets: EB instances, RDS, ElastiCache
  - NAT Gateway for outbound traffic from private subnets
- **Security Groups:**
  - ALB: Allow 80/443 from 0.0.0.0/0
  - EB instances: Allow traffic only from ALB
  - RDS: Allow 5432 only from EB security group
  - ElastiCache: Allow 6379 only from EB security group

### 4. Container Orchestration Alternative
**Consider migrating from Elastic Beanstalk to:**
- **AWS ECS (Fargate):** Serverless containers, better scaling, lower ops
- **AWS EKS (Kubernetes):** More control, industry standard, complex but powerful
- **Pros of ECS:** Simpler than EKS, native AWS integration, cost-effective
- **When to switch:** When you need finer control or hit EB limitations

---

## Security Hardening

### 1. Secrets Management
**Current:** Environment variables in EB  
**Production:** AWS Secrets Manager

- **Migrate all secrets:**
  - `POSTGRES_PASSWORD`
  - `POSTGRES_USER`
  - API keys, tokens, etc.
  
- **Implementation:**
  - Create secrets in Secrets Manager
  - Grant EB instance role permission to read secrets
  - Add `.ebextensions/secrets.config`:
    ```yaml
    commands:
      fetch_secrets:
        command: |
          aws secretsmanager get-secret-value --secret-id prod/db/password --query SecretString --output text > /tmp/db_pass
    ```
  - Reference in environment variables

- **Enable automatic rotation:**
  - Set rotation schedule (90 days recommended)
  - Use AWS Lambda rotation function

### 2. HTTPS/TLS Encryption
**Current:** HTTP only  
**Production:** HTTPS with valid certificate

- **AWS Certificate Manager (ACM):**
  - Request SSL/TLS certificate for your domain
  - Validate via DNS or email
  - Free and auto-renews

- **Configure HTTPS:**
  - EB Console → Configuration → Load Balancer
  - Add HTTPS listener on port 443
  - Attach ACM certificate
  - Redirect HTTP → HTTPS

- **Update nginx config:**
  - Force HTTPS redirects
  - Set HSTS headers
  - Configure secure cookie flags

### 3. Container Security Scanning
**Current:** No scanning  
**Production:** Automated vulnerability scanning

- **Options:**
  - AWS ECR image scanning (if using ECR instead of Docker Hub)
  - Snyk container scanning
  - Trivy (open-source)
  - Docker Hub vulnerability scanning

- **Add to CI/CD pipeline:**
  ```yaml
  - name: Scan Docker images
    uses: snyk/actions/docker@master
    with:
      image: ${{ secrets.DOCKER_USERNAME }}/multi-container-api:${{ github.sha }}
      args: --severity-threshold=high
  ```

### 4. IAM Best Practices
- **Principle of Least Privilege:**
  - Create service-specific IAM roles
  - Don't use root account
  - Enable MFA for all users
  
- **EB Instance Profile:**
  - Grant only necessary permissions:
    - CloudWatch Logs write
    - Secrets Manager read (specific secrets only)
    - S3 read (for deployment artifacts only)
  
- **GitHub Actions IAM User:**
  - Restrict to specific EB application/environment
  - No console access
  - Rotate keys every 90 days

### 5. Network Security
- **WAF (Web Application Firewall):**
  - Attach AWS WAF to ALB
  - Protect against SQL injection, XSS
  - Rate limiting to prevent DDoS
  
- **DDoS Protection:**
  - Enable AWS Shield Standard (free)
  - Consider Shield Advanced for critical apps ($3000/month)

- **VPC Flow Logs:**
  - Enable for network traffic analysis
  - Send to CloudWatch Logs or S3

### 6. Application Security
- **Add security headers in nginx:**
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header X-XSS-Protection "1; mode=block";
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
  add_header Content-Security-Policy "default-src 'self'";
  ```

- **Input validation:**
  - Sanitize all user inputs in API
  - Use parameterized queries (prevent SQL injection)
  - Implement rate limiting

- **Authentication & Authorization:**
  - Implement JWT or OAuth2
  - Use AWS Cognito for user management
  - Role-based access control (RBAC)

### 7. Dependency Security
- **Add to CI/CD:**
  ```yaml
  - name: npm audit
    run: npm audit --audit-level=high
    working-directory: ./api
  ```
  
- **Dependabot:**
  - Enable in GitHub (Settings → Security)
  - Auto-creates PRs for dependency updates
  - Review and merge security patches

---

## Database & Data Management

### 1. RDS Production Configuration
- **Multi-AZ deployment:** Automatic failover to standby
- **Read replicas:** Offload read traffic (analytics, reporting)
- **Parameter groups:** Optimize for your workload
- **Backup strategy:**
  - Automated daily backups (retain 35 days)
  - Manual snapshots before major changes
  - Test restore process monthly

### 2. Data Encryption
- **At rest:** Enable RDS encryption
- **In transit:** Force SSL connections
- **Application-level:** Encrypt sensitive fields (PII, PCI data)

### 3. Connection Pooling
- **Implement in API:**
  ```javascript
  // Use pg-pool instead of direct connections
  const { Pool } = require('pg');
  const pool = new Pool({
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  ```

- **Or use RDS Proxy:**
  - Connection pooling at AWS level
  - Reduces database load
  - Improves failover time

### 4. Database Migrations
- **Use migration tool:**
  - Flyway, Liquibase, or Knex migrations
  - Version control schema changes
  - Automated rollback capability

- **Add to CI/CD:**
  ```yaml
  - name: Run database migrations
    run: npm run migrate
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
  ```

### 5. Data Retention & Compliance
- **Define policies:**
  - How long to keep user data
  - GDPR right to be forgotten
  - Data export capabilities

- **Implement:**
  - Soft deletes vs hard deletes
  - Data archival to S3 Glacier
  - Audit logs for data access

---

## Monitoring & Observability

### 1. Application Performance Monitoring (APM)
**Options:**
- **AWS X-Ray:** Distributed tracing, service maps
- **DataDog:** Comprehensive, expensive
- **New Relic:** Full-stack observability
- **Sentry:** Error tracking
- **Grafana + Prometheus:** Open-source

**Implement:**
- Add tracing to API requests
- Monitor response times
- Track error rates
- Database query performance

### 2. Logging Strategy
**Current:** Basic EB logs  
**Production:** Centralized structured logging

- **CloudWatch Logs:**
  - Stream all container logs
  - Set retention policies (30 days for app logs, 90 days for security)
  - Create log groups per service

- **Structured logging:**
  ```javascript
  // Use pino, winston, or bunyan
  logger.info({
    requestId: req.id,
    userId: req.user.id,
    action: 'user.login',
    duration: 123,
  }, 'User login successful');
  ```

- **Log aggregation:**
  - Consider ELK Stack (Elasticsearch, Logstash, Kibana)
  - Or AWS OpenSearch Service

### 3. Metrics & Dashboards
- **CloudWatch Dashboards:**
  - Request rate, latency, error rate
  - CPU, memory, network
  - Database connections, query performance
  - Cache hit rate

- **Custom metrics:**
  - Business metrics (sign-ups, transactions)
  - Application-specific KPIs
  - Use CloudWatch PutMetricData API

### 4. Alerting
**Critical alerts (PagerDuty, phone):**
- Service down (5xx error rate > 5%)
- Database connection failures
- Disk space > 90%
- SSL certificate expiring < 30 days

**Warning alerts (email, Slack):**
- Response time > 500ms
- Error rate > 1%
- Memory usage > 80%
- Queue depth increasing

**Implementation:**
- CloudWatch Alarms → SNS → Lambda → Slack/PagerDuty
- Define runbooks for each alert
- Establish on-call rotation

### 5. Health Checks
**Add health endpoint to API:**
```javascript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
  };
  
  const healthy = checks.database && checks.redis;
  res.status(healthy ? 200 : 503).json(checks);
});
```

**Configure in ALB:**
- Path: `/health`
- Interval: 30 seconds
- Healthy threshold: 2
- Unhealthy threshold: 3
- Timeout: 5 seconds

---

## Performance & Scalability

### 1. Caching Strategy
**Application-level caching:**
- Cache API responses in Redis
- Set TTLs based on data volatility
- Implement cache invalidation
- Use cache-aside pattern

**CDN for static assets:**
- Use CloudFront in front of ALB
- Cache client static files (JS, CSS, images)
- Reduce origin load by 80%+

**Database query caching:**
- Use Redis for frequent queries
- Materialized views for reports

### 2. Database Optimization
- **Indexes:** Add indexes on frequently queried columns
- **Query optimization:** Use EXPLAIN, avoid N+1 queries
- **Partitioning:** For large tables (time-series data)
- **Connection pooling:** Already covered above

### 3. Horizontal Scaling
- **Stateless services:** No session state in containers
- **Session management:** Use Redis for sessions
- **File uploads:** Store in S3, not local filesystem
- **Background jobs:** Use SQS + worker pattern

### 4. API Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

### 5. Client Optimization
- **Code splitting:** Lazy load routes
- **Minification:** Already done by Vite
- **Compression:** Enable gzip/brotli in nginx
- **Image optimization:** WebP format, lazy loading
- **Service worker:** Offline capability

---

## CI/CD Improvements

### 1. Multi-Environment Pipeline
**Environments:**
- `dev` - Feature branches, auto-deploy
- `staging` - Pre-production testing, manual approval
- `production` - Live, manual approval + smoke tests

**GitHub Actions workflow:**
```yaml
deploy:
  strategy:
    matrix:
      environment: [staging, production]
  environment:
    name: ${{ matrix.environment }}
  # Staging auto-deploys, production requires approval
```

### 2. Blue-Green Deployments
- Configure EB to use blue-green
- Swap environment URLs after validation
- Instant rollback capability
- Zero downtime deployments

### 3. Canary Deployments
- Deploy to 10% of instances first
- Monitor error rates for 15 minutes
- Automatically rollback if errors spike
- Gradually increase to 100%

### 4. Automated Testing
**Add to pipeline:**
- **Unit tests** (already have)
- **Integration tests:** Test API endpoints
- **E2E tests:** Playwright or Cypress
- **Load tests:** k6, Artillery, or JMeter
- **Security tests:** OWASP ZAP, Burp Suite

**Example integration test:**
```yaml
- name: Integration tests
  run: |
    docker-compose -f docker-compose.test.yml up -d
    npm run test:integration
    docker-compose down
```

### 5. Deployment Safeguards
- **Pre-deployment checks:**
  - All tests pass
  - Code review approved
  - Security scan passed
  - No critical vulnerabilities

- **Post-deployment validation:**
  - Smoke tests (health check, critical paths)
  - Monitor error rates for 15 minutes
  - Automatic rollback on failure

### 6. Infrastructure as Code (IaC)
**Current:** Manual EB setup  
**Production:** Terraform or AWS CDK

**Benefits:**
- Version control infrastructure
- Reproducible environments
- Easy disaster recovery
- Code review for infra changes

**Example with Terraform:**
```hcl
resource "aws_elastic_beanstalk_application" "app" {
  name = "multi-container-app"
}

resource "aws_elastic_beanstalk_environment" "prod" {
  name        = "multi-container-prod"
  application = aws_elastic_beanstalk_application.app.name
  # ... configuration
}
```

---

## Disaster Recovery & Business Continuity

### 1. Backup Strategy
**RDS Backups:**
- Automated daily backups
- Manual snapshots before deployments
- Cross-region backup replication
- Test restore monthly

**Application State:**
- Redis snapshots to S3
- ElastiCache automatic backups

**Configuration:**
- Version control all configs
- Store secrets in Secrets Manager (auto-replicated)

### 2. Disaster Recovery Plan
**RTO (Recovery Time Objective):** How long to restore service  
**RPO (Recovery Point Objective):** How much data loss acceptable

**Example targets:**
- RTO: 1 hour
- RPO: 5 minutes

**Implementation:**
- Multi-region failover setup
- Automated failover for RDS
- Route53 health checks with failover routing
- Document recovery procedures (runbook)

### 3. Regular DR Testing
- **Quarterly:** Test backup restore
- **Annually:** Full DR simulation
- **Document lessons learned**
- **Update runbooks**

### 4. Incident Response Plan
1. **Detection:** Monitoring alerts
2. **Triage:** Assess severity, impact
3. **Communication:** Status page, stakeholder notification
4. **Resolution:** Fix or rollback
5. **Post-mortem:** Root cause analysis, preventive measures

**Tools:**
- StatusPage.io or custom status page
- Incident management: PagerDuty, Opsgenie
- Postmortem template in Confluence/Notion

---

## Cost Optimization

### 1. Right-Sizing Resources
- Start small, scale based on metrics
- Use AWS Cost Explorer to identify waste
- Reserved instances for predictable workloads (1-3 year commits)
- Savings Plans for compute (more flexible)

### 2. Auto-Scaling Policies
- Scale down during off-peak hours
- Use scheduled scaling (if traffic patterns predictable)
- Target tracking scaling (maintain CPU at 70%)

### 3. Database Optimization
- Use Aurora Serverless for variable workloads
- Delete old data, archive to S3
- Resize instances based on actual usage

### 4. Monitoring Costs
- Set budget alerts in AWS Budgets
- Tag all resources for cost allocation
- Review monthly and optimize

**Example monthly costs (production):**
- EB instances (2x t3.medium): ~$60
- ALB: ~$20
- RDS (db.t3.small Multi-AZ): ~$70
- ElastiCache (cache.t3.micro): ~$15
- CloudWatch, S3, data transfer: ~$20
- **Total: ~$185/month** (scales with traffic)

---

## Compliance & Governance

### 1. Access Control
- **AWS Organizations:** Separate accounts for dev/staging/prod
- **SSO:** AWS IAM Identity Center
- **MFA:** Required for all users
- **Audit:** CloudTrail for all API calls

### 2. Compliance Standards
**Depending on your industry:**
- **GDPR:** EU data protection
- **HIPAA:** Healthcare data
- **PCI DSS:** Payment card data
- **SOC 2:** Security, availability, confidentiality

**AWS Compliance Programs:**
- Use compliant services
- Enable AWS Config for compliance rules
- AWS Artifact for compliance reports

### 3. Data Residency
- Deploy in specific regions for compliance
- Use S3 bucket policies to prevent cross-region replication
- Document data flow

### 4. Change Management
- All changes via pull requests
- Approval required for production
- Maintain change log
- Communication plan for maintenance windows

---

## Implementation Roadmap

### Phase 1: Critical Security (Week 1-2)
- [ ] Enable HTTPS with ACM certificate
- [ ] Move secrets to Secrets Manager (currently in EB env vars)
- [ ] Set up WAF on ALB
- [ ] Enable MFA for all AWS accounts
- [ ] Implement security headers in nginx

### Phase 2: Infrastructure Hardening (Week 3-4) - PARTIALLY COMPLETE ✅
- [✅] Migrate to RDS (DONE - currently db.t3.micro)
- [✅] Migrate to ElastiCache (DONE - currently Serverless)
- [ ] Upgrade RDS to Multi-AZ for high availability
- [ ] Set up VPC with public/private subnets
- [ ] Move RDS and ElastiCache to private subnets
- [ ] Configure security groups properly (currently open for setup)
- [ ] Enable auto-scaling for EB (min 2 instances)

### Phase 3: Observability (Week 5-6)
- [ ] Set up CloudWatch dashboards
- [ ] Implement structured logging
- [ ] Configure critical alerts
- [ ] Add APM (X-Ray or DataDog)
- [ ] Create health check endpoints

### Phase 4: CI/CD Improvements (Week 7-8)
- [ ] Add integration tests to pipeline
- [ ] Set up staging environment
- [ ] Implement blue-green deployments
- [ ] Add automated security scanning
- [ ] Create deployment runbooks

### Phase 5: Performance & Scalability (Week 9-10)
- [ ] Implement caching strategy
- [ ] Set up CloudFront CDN
- [ ] Optimize database queries
- [ ] Add rate limiting
- [ ] Load testing

### Phase 6: DR & Business Continuity (Week 11-12)
- [ ] Document DR procedures
- [ ] Test backup restore
- [ ] Set up cross-region replication
- [ ] Create incident response plan
- [ ] Run DR simulation

---

## Production Checklist

Before going live, verify:

### Security
- [ ] HTTPS enabled with valid certificate
- [ ] Secrets in Secrets Manager, not environment variables
- [ ] WAF configured with OWASP rules
- [ ] Security groups follow least privilege
- [ ] Dependency scanning in CI/CD
- [ ] Container vulnerability scanning enabled
- [ ] MFA enabled for all users
- [ ] IAM policies follow least privilege

### Infrastructure
- [✅] RDS PostgreSQL created (needs Multi-AZ upgrade)
- [✅] ElastiCache Redis created (needs backup configuration)
- [ ] Multi-AZ deployment
- [ ] Auto-scaling configured
- [ ] RDS Multi-AZ with automated backups
- [ ] ElastiCache with backups
- [ ] Health checks configured
- [ ] Load balancer configured
- [ ] VPC with public/private subnets

### Monitoring
- [ ] CloudWatch dashboards created
- [ ] Critical alerts configured
- [ ] PagerDuty/on-call rotation set up
- [ ] Logging to CloudWatch Logs
- [ ] APM/tracing enabled
- [ ] Status page available

### CI/CD
- [ ] Automated tests passing
- [ ] Staging environment exists
- [ ] Blue-green deployment configured
- [ ] Rollback procedure documented
- [ ] Deployment requires approval

### Documentation
- [ ] Architecture diagram
- [ ] Runbooks for common issues
- [ ] DR procedures documented
- [ ] Incident response plan
- [ ] On-boarding guide for new developers

### Performance
- [ ] Load testing completed
- [ ] CDN configured for static assets
- [ ] Database indexed and optimized
- [ ] Caching strategy implemented
- [ ] Rate limiting configured

### Business Continuity
- [ ] Backup restore tested
- [ ] DR plan documented and tested
- [ ] RTO/RPO defined
- [ ] Incident escalation process
- [ ] Customer communication plan

---Current Development Setup)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **Compute** | | |
| Elastic Beanstalk | 1x t2.small | $17 |
| **Database** | | |
| RDS PostgreSQL | db.t3.micro (current) | $15 |
| ElastiCache Redis | Serverless (current) | ~$10-20 (usage-based) |
| **Networking** | | |
| Data Transfer | Minimal | $5 |
| **Storage** | | |
| S3 | Deployment artifacts | $1 |
| **Total (Development)** | | **~$50-60/month** |

---

## Estimated Costs (Recommended 

## Estimated Costs (Production Environment)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **Compute** | | |
| Elastic Beanstalk | 2x t3.medium (auto-scaling) | $60 |
| Application Load Balancer | - | $20 |
| **Database** | | |
| RDS PostgreSQL | db.t3.small Multi-AZ | $70 |
| ElastiCache Redis | cache.t3.micro | $15 |
| RDS Backups | 100GB storage | $10 |
| **Networking** | | |
| CloudFront CDN | 1TB data transfer | $85 |
| NAT Gateway | - | $33 |
| Data Transfer | 1TB outbound | $90 |
| **Security & Monitoring** | | |
| AWS Secrets Manager | 5 secrets | $2 |
| CloudWatch Logs | 10GB ingestion | $5 |
| CloudWatch Alarms | 10 alarms | $1 |
| AWS WAF | - | $5 |
| **Storage** | | |
| S3 | 100GB | $2.30 |
| **Total** | | **~$400/month** |

**Notes:**
- Costs scale with traffic and data storage
- First year can use AWS Free Tier for some services
- Reserved Instances can save 30-40% for compute
- Production costs vary widely based on actual usage

---

## Additional Resources

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Twelve-Factor App](https://12factor.net/)
- [SRE Book (Google)](https://sre.google/sre-book/table-of-contents/)
- [AWS Security Best Practices](https://docs.aws.amazon.com/security/)
