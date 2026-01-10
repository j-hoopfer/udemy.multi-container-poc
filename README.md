# Multi-Container Fibonacci Calculator

A full-stack application that calculates Fibonacci numbers using a microservices architecture with Docker containers. This project demonstrates multi-container orchestration, container networking, and deployment workflows.

## Architecture

The application consists of five main services:

- **Nginx (Front Door)**: Reverse proxy that routes traffic to appropriate services
- **Client**: React + Vite frontend application
- **API**: Hapi.js backend server that handles HTTP requests
- **Worker**: Background process that calculates Fibonacci numbers
- **Postgres**: Database for storing calculated indices
- **Redis**: Cache for storing Fibonacci calculation results and pub/sub messaging

### Data Flow

1. User submits an index through the React frontend
2. Client sends POST request to the API server via Nginx
3. API stores the index in Postgres and publishes to Redis
4. Worker subscribes to Redis messages and calculates Fibonacci numbers
5. Worker stores results back in Redis
6. Client fetches and displays results from both Postgres and Redis

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Node.js 18+ (for local development without Docker)
- Git

## Project Structure

```
.
├── docker-compose.yml           # Development configuration
├── docker-compose.prod.yml      # Production configuration
├── api/                         # Backend API service
│   ├── Dockerfile              # Production build
│   ├── Dockerfile.dev          # Development build
│   ├── index.js                # Main server file
│   ├── postgres.js             # Postgres client
│   └── redis.js                # Redis client
├── client/                      # React frontend
│   ├── Dockerfile              # Production build
│   ├── Dockerfile.dev          # Development build
│   └── src/
│       ├── App.jsx
│       └── Fib.jsx             # Fibonacci calculator component
├── worker/                      # Background worker service
│   ├── Dockerfile              # Production build
│   ├── Dockerfile.dev          # Development build
│   ├── index.js                # Worker process
│   └── redis.js                # Redis client
└── front-door/                  # Nginx reverse proxy
    ├── Dockerfile              # Production build
    ├── Dockerfile.dev          # Development build
    └── default.conf            # Nginx configuration
```

## Development

### Quick Start

1. **Clone the repository**
   ```bash
   cd /path/to/udemy.multi-container
   ```

2. **Start all services**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3050
   - API Health Check: http://localhost:3050/api/health

### Development Features

- **Hot Reload**: All services support hot reloading during development
  - Client: Vite HMR
  - API: Node.js `--watch` flag
  - Worker: Node.js `--watch` flag
- **Volume Mounting**: Source code is mounted for live updates
- **Service Dependencies**: Containers start in the correct order using `depends_on`

### Running Individual Services

You can start specific services:

```bash
# Start only the database
docker-compose up postgres redis

# Start frontend only
docker-compose up client nginx

# View logs for a specific service
docker-compose logs -f api
```

### Running Tests

Each service has its own test suite:

```bash
# Test the API
docker-compose exec api npm test

# Test the client
docker-compose exec client npm test

# Test the worker
docker-compose exec worker npm test
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean database)
docker-compose down -v
```

## Building for Production

### 1. Build Production Images

First, set your Docker Hub username:

```bash
export DOCKER_USERNAME=your-dockerhub-username
```

Build all production images:

```bash
# Build all services
docker build -t $DOCKER_USERNAME/multi-container-nginx:latest ./front-door
docker build -t $DOCKER_USERNAME/multi-container-client:latest ./client
docker build -t $DOCKER_USERNAME/multi-container-api:latest ./api
docker build -t $DOCKER_USERNAME/multi-container-worker:latest ./worker
```

Or use a build script:

```bash
#!/bin/bash
# build-prod.sh

export DOCKER_USERNAME=${DOCKER_USERNAME:-your-dockerhub-username}

echo "Building production images for $DOCKER_USERNAME..."

docker build -t $DOCKER_USERNAME/multi-container-nginx:latest ./front-door
docker build -t $DOCKER_USERNAME/multi-container-client:latest ./client
docker build -t $DOCKER_USERNAME/multi-container-api:latest ./api
docker build -t $DOCKER_USERNAME/multi-container-worker:latest ./worker

echo "Build complete!"
```

### 2. Push Images to Docker Hub

```bash
# Login to Docker Hub
docker login

# Push all images
docker push $DOCKER_USERNAME/multi-container-nginx:latest
docker push $DOCKER_USERNAME/multi-container-client:latest
docker push $DOCKER_USERNAME/multi-container-api:latest
docker push $DOCKER_USERNAME/multi-container-worker:latest
```

### 3. Production Deployment Configuration

The production configuration (`docker-compose.prod.yml`) requires external services:

#### Required Environment Variables

```bash
export DOCKER_USERNAME=your-dockerhub-username
export POSTGRES_PASSWORD=your-secure-password
```

#### External Services Setup

1. **PostgreSQL Database**
   - Provider: AWS RDS, DigitalOcean, or similar
   - Update `PGHOST` in [docker-compose.prod.yml](docker-compose.prod.yml#L22)
   - Engine: PostgreSQL 15+
   - Configure security groups to allow container access

2. **Redis Cache**
   - Provider: AWS ElastiCache, Redis Cloud, or similar
   - Update `REDIS_HOST` in [docker-compose.prod.yml](docker-compose.prod.yml#L21)
   - Version: Redis 7+
   - Ensure network access from container hosts

#### Create Production Database Schema

Before deploying, initialize the database:

```sql
CREATE TABLE values (
    number INTEGER PRIMARY KEY
);
```

### 4. Deploy to Production

On your production server:

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### 5. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Test the application
curl http://your-server-ip/api/health
```

## Deployment Platforms

### AWS Elastic Beanstalk

1. Install EB CLI:
   ```bash
   pip install awsebcli
   ```

2. Initialize EB application:
   ```bash
   eb init -p docker multi-container-app
   ```

3. Create environment:
   ```bash
   eb create production-env
   ```

4. Deploy:
   ```bash
   eb deploy
   ```

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml multi-container-app

# Check services
docker service ls
```

### Kubernetes

For Kubernetes deployment, you'll need to create:
- Deployment manifests for each service
- Service definitions for networking
- ConfigMaps for environment variables
- Secrets for sensitive data

## Environment Variables

### Development (Automatically Configured)

All development environment variables are set in `docker-compose.yml`:
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `PGHOST=postgres`
- `PGPORT=5432`
- `POSTGRES_DB=postgres`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres_password`

### Production (Required Configuration)

Set these before deploying:
- `DOCKER_USERNAME`: Your Docker Hub username
- `POSTGRES_PASSWORD`: Secure password for PostgreSQL
- Update Redis and PostgreSQL hosts in [docker-compose.prod.yml](docker-compose.prod.yml)

## Troubleshooting

### Services Won't Start

```bash
# Check service logs
docker-compose logs

# Rebuild services
docker-compose down
docker-compose up --build

# Clean everything
docker-compose down -v
docker system prune -a
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres

# View API logs
docker-compose logs api
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Connect to Redis CLI
docker-compose exec redis redis-cli

# Test connection
docker-compose exec redis redis-cli ping
```

### Port Already in Use

If port 3050 is already in use, modify `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "8080:80"  # Change 3050 to 8080 or any available port
```

## Performance Optimization

### Production Best Practices

1. **Multi-stage Builds**: All Dockerfiles use multi-stage builds to minimize image size
2. **Node Modules Caching**: Dependencies are cached in separate layers
3. **Nginx Caching**: Configure Nginx to cache static assets
4. **Connection Pooling**: PostgreSQL uses connection pooling for better performance
5. **Redis Persistence**: Configure Redis persistence for production data durability

### Scaling

Scale individual services:

```bash
# Scale worker processes
docker-compose up -d --scale worker=3

# In production
docker-compose -f docker-compose.prod.yml up -d --scale worker=5
```

## Monitoring

### Health Checks

API health endpoint:
```bash
curl http://localhost:3050/api/health
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f worker
```

### Container Stats

```bash
# View resource usage
docker stats

# Using docker-compose
docker-compose stats
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test` in each service directory
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

## License

This project is for educational purposes as part of the Docker and Kubernetes course.

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [React Documentation](https://react.dev/)
- [Hapi.js Documentation](https://hapi.dev/)
