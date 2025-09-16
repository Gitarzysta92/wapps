#!/bin/bash
# Simple GitHub Actions Runner Installation

set -e

# Create user
useradd --system --shell /bin/bash --home-dir /home/github-runner --create-home github-runner

# Create directory
mkdir -p /home/github-runner/actions-runner
chown github-runner:github-runner /home/github-runner/actions-runner

# Download and extract
cd /tmp
curl -L -o actions-runner.tar.gz https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.311.0.tar.gz
tar -xzf actions-runner.tar.gz -C /home/github-runner/actions-runner --strip-components=1
chown -R github-runner:github-runner /home/github-runner/actions-runner

# Install dependencies
apt-get update
apt-get install -y libc6 libssl3 libstdc++6 zlib1g

# Create systemd service
cat > /etc/systemd/system/github-actions-runner.service << 'SERVICE_EOF'
[Unit]
Description=GitHub Actions Runner
After=network.target

[Service]
Type=simple
User=github-runner
Group=github-runner
WorkingDirectory=/home/github-runner/actions-runner
ExecStart=/home/github-runner/actions-runner/run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Reload systemd
systemctl daemon-reload

echo "GitHub Actions runner installed!"
echo "Configure with: sudo -u github-runner /home/github-runner/actions-runner/config.sh --url <repo-url> --token <token>"
echo "Enable with: sudo systemctl enable --now github-actions-runner"
