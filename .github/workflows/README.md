# GitHub Actions CI/CD Setup Guide

This GitHub Actions workflow automates testing, building, and deploying your multi-container application to AWS Elastic Beanstalk using Docker Compose.

## Architecture Overview

The project uses a multi-container architecture with:
- **Client** - React frontend (Vite) served by nginx
- **API** - Hapi.js backend server
- **Worker** - Background worker for processing tasks
- **Nginx** - Reverse proxy/load balancer
- **PostgreSQL** - AWS RDS (managed database)
- **Redis** - AWS ElastiCache Serverless (managed cache/message broker)

## Prerequisites

### 1. Docker Hub Account
Create a Docker Hub account at https://hub.docker.com if you don't have one.

### 2. AWS RDS PostgreSQL Setup
1. Go to AWS RDS Console
2. Create database → PostgreSQL
3. Choose production or dev/test template
4. DB instance identifier: `multi-container-app`
5. Master username: `postgres`
6. Generate strong password (save for later)
7. Instance: db.t3.micro minimum (db.t3.small for production)
8. Storage: 20GB minimum, enable autoscaling
9. VPC: Same as your EB environment
10. Public access: No (unless needed for development)
11. Security group: Allow port 5432 from EB instances
12. Save the endpoint (e.g., `multi-container-app.cluster-xxxxx.us-east-1.rds.amazonaws.com`)

### 3. AWS ElastiCache Redis Setup
1. Go to AWS ElastiCache Console
2. Create cache → Redis
3. Choose "Serverless" for auto-scaling (or "Design your own cache" for fixed size)
4. Name: `multi-container-app`
5. VPC: Same as your EB environment
6. Security group: Allow port 6379 from EB instances
7. Save the endpoint (e.g., `multi-container-app-xxxxx.serverless.use1.cache.amazonaws.com:6379`)

### 4. AWS Elastic Beanstalk Setup
1. Go to AWS Elastic Beanstalk Console
2. Click "Create Application"
3. Application name: `multi-container-app`
4. Platform: Docker → "Multi-container Docker"
5. Platform branch: Choose latest version
6. Create environment name: `multi-container-env`
7. Select instance type (t2.small minimum for multi-container)
8. VPC: Same as RDS and ElastiCache
9. Note your AWS region (default in workflow is `us-east-1`)

### 5. Required GitHub Secrets
Add these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

#### Docker Hub Credentials:
- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password or personal access token (recommended)

#### AWS Credentials:
- `AWS_ACCESS_KEY_ID`: Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key

**To create AWS credentials:**
1. Go to AWS IAM Console
2. Create a new user (e.g., `github-actions-deployer`)
3. Attach these policies:
   - `AWSElasticBeanstalkFullAccess`
   - `AmazonS3FullAccess` (for deployment artifacts)
4. Under "Security credentials" → Create access key → Choose "Application running outside AWS"
5. Save the access key ID and secret access key

### 6. Elastic Beanstalk Environment Properties
Set these environment variables in your EB environment (Configuration → Software → Environment properties):

- `POSTGRES_PASSWORD`: The master password you set when creating RDS (must match exactly)

## Configuration

### Customize Application/Environment Names
If you use different names for your Elastic Beanstalk app/environment, update these in `.github/workflows/deploy.yml`:

```yaml
application_name: multi-container-app  # Change to your app name
environment_name: multi-container-env  # Change to your environment name
region: us-east-1                      # Change to your AWS region
```

## CI/CD Pipeline Details

The workflow consists of 3 sequential jobs that run on every push to `main` or `master`:

### Job 1: Test Services (Runs in Parallel)
**Purpose**: Ensure code quality before building images

**What happens:**
1. Checks out code from repository
2. Sets up Node.js 24 with npm caching
3. Runs tests for each service in parallel matrix:
   - `api`: Runs `npm test` for backend tests
   - `client`: Runs `npm test` for frontend tests
   - `worker`: Runs `npm test` for worker tests
4. If any test fails, pipeline stops immediately

**Duration**: ~2-3 minutes (parallel execution)

---

### Job 2: Build and Push Docker Images
**Purpose**: Create production-ready Docker images

**What happens:**
1. Waits for test job to succeed
2. Checks out code
3. Sets up Docker Buildx (advanced build features)
4. Logs into Docker Hub using secrets
5. Builds and pushes 4 images in sequence:
   - **API**: `your-username/multi-container-api`
   - **Client**: `your-username/multi-container-client`
   - **Worker**: `your-username/multi-container-worker`
   - **Nginx**: `your-username/multi-container-nginx`

**Each image is tagged with:**
- `latest` - Always points to most recent build
- `<git-sha>` - Specific commit SHA for rollback capability

**Build optimizations:**
- Uses GitHub Actions cache for Docker layers
- Speeds up subsequent builds by reusing unchanged layers
- Typical first build: ~5-7 minutes
- Subsequent builds: ~2-3 minutes

**Duration**: ~3-5 minutes (cached), ~7-10 minutes (first build)

---

### Job 3: Deploy to AWS Elastic Beanstalk
**Purpose**: Deploy new version to production

**What happens:**

1. **Checkout code**
   - Gets latest code including `docker-compose.prod.yml`

2. **Prepare docker-compose for deployment**
   ```bash
   envsubst '${DOCKER_USERNAME}' < docker-compose.prod.yml > docker-compose.yml
   ```
   - Uses `envsubst` (Linux text substitution utility)
   - Replaces `${DOCKER_USERNAME}` with your Docker Hub username
   - Leaves `${POSTGRES_PASSWORD}` untouched for EB to inject
   - Example transformation:
     ```yaml
     # Before (docker-compose.prod.yml):
     image: ${DOCKER_USERNAME}/multi-container-api:latest
     
     # After (docker-compose.yml):
     image: yourname/multi-container-api:latest
     ```

3. **Generate deployment package**
   ```bash
   zip -r deploy.zip docker-compose.yml .ebextensions
   ```
   - Creates zip with docker-compose.yml and EB configuration
   - EB will use this to pull images and configure containers

4. **Create version label**
   - Format: `<commit-sha>-<timestamp>`
   - Example: `a1b2c3d-20260102143022`
   - Allows tracking of deployed versions

5. **Deploy to Elastic Beanstalk**
   - Uploads deployment package to S3
   - Creates new application version
   - Deploys to environment (pulls Docker images, starts containers)
   - Waits up to 5 minutes for health checks to pass
   - If health checks fail, deployment is marked as failed

**Duration**: ~5-8 minutes

---

### Total Pipeline Duration
- **Success path**: ~10-15 minutes
- **Failure at tests**: ~2-3 minutes (fast feedback)
- **Failure at build**: ~5-8 minutes
- **Failure at deploy**: ~10-15 minutes

## Docker Compose Files

The project uses two separate docker-compose files:

### `docker-compose.yml` (Local Development)
- Uses `Dockerfile.dev` for hot-reload during development
- Mounts local code as volumes for instant updates
- Runs PostgreSQL and Redis as local containers
- Exposes database ports (5432, 6379) for debugging
- Uses hardcoded dev credentials (safe for local only)
- Run with: `docker-compose up`

### `docker-compose.prod.yml` (Production Template)
- Uses pre-built images from Docker Hub
- No volume mounts (immutable containers)
- Only exposes port 80 (nginx)
- Connects to AWS RDS PostgreSQL (managed database)
- Connects to AWS ElastiCache Redis (managed cache)
- No containerized databases (uses managed services)
- Uses environment variable substitution for secrets
- Transformed by CI/CD pipeline before deployment

## Triggering Deployments

The workflow automatically triggers on pushes to:
- `main` branch
- `master` branch

**To deploy:**
```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

**WMonitoring and Logs

### GitHub Actions Monitoring
1. Go to repository → **Actions** tab
2. Click on the running/completed workflow
3. View job details and logs in real-time
4. Download logs for offline analysis

### Elastic Beanstalk Monitoring
1. Go to EB console → Your environment
2. **Health** tab: Overall environment status
3. **Monitoring** tab: CPU, memory, network metrics
4. **Logs** tab: Request logs, container logs
5. **Events** tab: Deployment history and errors

### Container-Level Debugging
**View logs for specific container:**
```bash
# From EB console → Logs → Request Logs → Last 100 Lines
# Look for container names: nginx, client, api, worker, postgres, redis
```

**Rolling Back a Deployment

If a deployment causes issues:

**Option 1: Revert via EB Console**
1. Go to EB environment → Application versions
2. Find previous working version
3. Click **Deploy** on that version

**Option 2: Revert via Git**
```bash
git revert HEAD
git push origin main
# Pipeline will auto-deploy previous working state
```

**Option 3: Deploy specific commit SHA**
- Manually trigger workflow from GitHub Actions with specific commit
- Or push previous commit as new commit

## Best Practices

### Development Workflow
1. ✅ Work on feature branches, not directly on `main`
2. ✅ Run tests locally before pushing: `npm test`
3. ✅ Test Docker builds locally: `docker-compose up`
4. ✅ Use pull requests for code review
5. ✅ Squash commits for cleaner history

### CI/CD Best Practices
1. ✅ Keep workflows fast (current: ~10-15 min is good)
2. ✅ Use caching for npm and Docker layers
3. ✅ Fail fast (tests run before expensive build step)
4. ✅ Tag images with commit SHA for traceability
5. ✅ Monitor workflow success rate

### Security Best Practices
1. ✅ **Never commit secrets** - Use GitHub Secrets and EB environment properties
2. ✅ **Rotate credentials regularly** - AWS keys, Docker Hub tokens, DB passwords
3. ✅ **Use IAM least privilege** - Only grant necessary permissions
4. ✅ **Use Docker Hub personal access tokens** - More secure than passwords
5. ✅ **Enable HTTPS in production** - Use AWS Certificate Manager
6. ✅ **Keep images updated** - Regular dependency updates
7. ✅ **Scan images for vulnerabilities** - Use `docker scan` or Snyk

### Cost Optimization
1. 💰 **Use smallest instance that works** - t2.small minimum for multi-container
2. 💰 **Consider managed services for production:**
   - RDS for PostgreSQL (more reliable, automated backups)
   - ElastiCache for Redis (better performance, HA)
3. 💰 **Enable auto-scaling only if needed** - Single instance is cheaper for dev/staging
4. 💰 **Delete unused EB environments** - Don't leave dev/test environments running
5. 💰 **Use EB CLI for local testing** - Test deployments before pushing to reduce failed deployments

### Production Readiness Checklist
- [ ] Set strong `POSTGRES_PASSWORD` in EB environment properties
- [ ] Configure custom domain and SSL certificate
- [ ] Set up EB health check endpoint
- [ ] Enable EB environment logs streaming to CloudWatch
- [ ] Configure backup strategy for PostgreSQL data
- [ ] Set up monitoring and alerts (CloudWatch Alarms)
- [ ] Document rollback procedures
- [ ] Test disaster recovery process
- [ ] Set up staging environment for pre-production testing
- [ ] Configure EB auto-scaling (if needed)

## Additional Resources

- [Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
  ```
- Fix failing tests before pushing again
- Ensure all dependencies are installed: `npm ci`

---

### 🔴 Docker Build Failing
**Symptoms:** "Build and Push Docker Images" job fails

**Common causes:**
1. **Invalid Dockerfile syntax**
   - Check Dockerfile for each service
   - Test locally: `docker build -f api/Dockerfile api/`

2. **Docker Hub authentication failed**
   - Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are correct
   - Check if Docker Hub password or token is expired
   - Try logging in manually: `docker login`

3. **Docker Hub rate limits**
   - Free accounts: 100 pulls/6 hours
   - Solution: Upgrade account or use authentication

4. **Storage quota exceeded**
   - Check Docker Hub account storage limits
   - Delete old unused images from Docker Hub

---

### 🔴 Deployment Failing
**Symptoms:** "Deploy to Elastic Beanstalk" job fails or EB shows degraded health

**Diagnostic steps:**
1. **Verify AWS credentials**
   ```bash
   # Test credentials locally (install AWS CLI first)
   aws sts get-caller-identity
   ```
   - Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct in GitHub secrets
   - Check IAM permissions include Elastic Beanstalk and S3

2. **Check application/environment names**
   - Workflow must match EB console exactly (case-sensitive)
   - Verify in `.github/workflows/deploy.yml`:
     ```yaml
     application_name: multi-container-app
     environment_name: multi-container-env
     ```

3. **Review EB deployment logs**
   - EB Console → Environments → Logs → Request Logs
   - Look for errors in `/var/log/eb-engine.log`

4. **Image pull failures**
   - Ensure images were successfully pushed to Docker Hub
   - Check image names match in `docker-compose.prod.yml`
   - Verify images are public (or EB has Docker Hub credentials)

---

### 🔴 Container Not Starting
**Symptoms:** EB environment degraded, containers crash-looping

**Solutions:**

1. **Check environment variables**
   - EB Console → Configuration → Software → Environment properties
   - Ensure `POSTGRES_PASSWORD` is set
   - Verify variable names match docker-compose.prod.yml

2. **Memory issues**
   - Default EB instance (t2.micro) may be too small
   - Upgrade to t2.small or larger
   - EB Console → Configuration → Instances

3. **Container startup failures**
   - Check container logs in EB console
   - Common issues:
     - Database connection failures (wrong host/password)
     - Missing environment variables
     - Application code errors

4. **Port conflicts**
   - Ensure only nginx exposes port 80
   - Internal containers should not expose host ports

---

### 🔴 Database Connection Errors
**Symptoms:** API/Worker can't connect to PostgreSQL

**Solutions:**
- Verify `POSTGRES_PASSWORD` environment property is set in EB
- Check container links in docker-compose.prod.yml
- Ensure postgres container is running: `docker ps` (if SSH'd into EB instance)
- Verify connection string: `PGHOST=postgres` (hostname matches service name)
**GitHub Actions (deploy.yml):**
- Reads from GitHub Secrets: `${{ secrets.DOCKER_USERNAME }}`
- Injected at runtime, never logged or exposed
- Used to login to Docker Hub and AWS

**Production Template (docker-compose.prod.yml):**
- Uses placeholder: `${POSTGRES_PASSWORD}`
- Not substituted by GitHub Actions
- Remains as literal `${POSTGRES_PASSWORD}` in deployment package

**Elastic Beanstalk Runtime:**
- Reads environment properties you configured
- Injects actual values when starting containers
- Example: `POSTGRES_PASSWORD=your-secure-password-here`

**Security Benefits:**
- Passwords never in source code
- Different credentials per environment
- Easy rotation without code changes

## Monitoring Deployments

1. Check GitHub Actions tab in your repository for workflow status
2. Monitor AWS Elastic Beanstalk console for deployment progress
3. View application logs in Elastic Beanstalk → Logs

## Troubleshooting

### Tests Failing
- Check test logs in GitHub Actions
- Run tests locally: `cd api && npm test`

### Docker Build Failing
- Verify Dockerfiles are correct
- Check Docker Hub credentials in GitHub secrets
- Ensure you have enough space in your Docker Hub account

### Deployment Failing
- Verify AWS credentials are correct
- Check Elastic Beanstalk application/environment names match
- Ensure Dockerrun.aws.json has correct Docker Hub username
- Review Elastic Beanstalk logs for specific errors

### Container Not Starting
- Check memory allocation in Dockerrun.aws.json (may need to increase)
- Verify environment variables are correct
- Check container logs in Elastic Beanstalk dashboard

## Cost Optimization

To reduce costs:
1. Use smaller instance types for development
2. Consider using RDS for PostgreSQL instead of container-based (more reliable)
3. Use ElastiCache for Redis in production (better performance)
4. Set up auto-scaling only if needed

## Security Best Practices

1. ✅ Use GitHub Secrets for sensitive data
2. ✅ Use AWS Secrets Manager for production passwords
3. ✅ Rotate AWS access keys regularly
4. ✅ Use IAM roles with minimal required permissions
5. ✅ Enable HTTPS in production
6. ✅ Keep Docker images updated regularly
