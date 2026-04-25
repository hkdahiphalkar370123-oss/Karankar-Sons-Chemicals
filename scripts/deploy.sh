#!/bin/bash
# Production Deployment Script
# Sets up and starts the application in production mode
# Usage: bash scripts/deploy.sh

echo ""
echo "=========================================="
echo "🚀 PRODUCTION DEPLOYMENT SCRIPT"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_ENV=production
PORT=${PORT:-5000}
INSTALL_DEPS=${INSTALL_DEPS:-true}
RUN_TESTS=${RUN_TESTS:-true}
CLEANUP=${CLEANUP:-true}

cd "$(dirname "$0")/.." || exit 1

echo -e "${BLUE}Current directory: $(pwd)${NC}\n"

# Step 1: Check Node.js installation
echo -e "${YELLOW}Step 1: Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"
echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}\n"

# Step 2: Clean up unused files
if [ "$CLEANUP" = true ]; then
    echo -e "${YELLOW}Step 2: Cleaning up unused files...${NC}"
    node scripts/cleanup.js
    echo ""
fi

# Step 3: Install dependencies
if [ "$INSTALL_DEPS" = true ]; then
    echo -e "${YELLOW}Step 3: Installing dependencies...${NC}"
    npm install --production
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependencies installed${NC}\n"
fi

# Step 4: Check environment configuration
echo -e "${YELLOW}Step 4: Checking environment configuration...${NC}"
if [ ! -f .env.production ]; then
    echo -e "${RED}✗ .env.production file not found${NC}"
    echo -e "${YELLOW}Please copy .env.example to .env.production and configure it${NC}"
    exit 1
fi
echo -e "${GREEN}✓ .env.production file found${NC}\n"

# Step 5: Run tests
if [ "$RUN_TESTS" = true ]; then
    echo -e "${YELLOW}Step 5: Running comprehensive tests...${NC}"
    node backend/tests/runTests.js
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Tests failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ All tests passed${NC}\n"
fi

# Step 6: Start the server
echo -e "${YELLOW}Step 6: Starting the server...${NC}"
echo -e "${BLUE}Environment: ${NODE_ENV}${NC}"
echo -e "${BLUE}Port: ${PORT}${NC}\n"

export NODE_ENV=production
export PORT=$PORT

# Use pm2 if available, otherwise use node directly
if command -v pm2 &> /dev/null; then
    echo -e "${BLUE}Starting with PM2...${NC}"
    pm2 restart karankarsons || pm2 start backend/index.js --name karankarsons --env production
    pm2 logs karankarsons
else
    echo -e "${BLUE}Starting with Node.js...${NC}"
    cd backend
    node index.js
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
