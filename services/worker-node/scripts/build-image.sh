#!/bin/bash
docker build \
  --platform linux/arm64 \
  -t fusio-browser:latest \
  -f docker/Dockerfile.browser \
  .
echo "Image built: fusio-browser:latest"
