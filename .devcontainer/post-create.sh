#!/usr/bin/env bash
set -euo pipefail

echo "==> Install k3d"
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

echo "==> Install Packer"
PACKER_VERSION=1.11.2
curl -fsSL -o /tmp/packer.zip \
  "https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_amd64.zip"
sudo unzip -o /tmp/packer.zip -d /usr/local/bin
rm -f /tmp/packer.zip

echo "==> Install Ansible + Kubernetes deps"
python3 -m pip install --user --quiet ansible kubernetes PyYAML jinja2
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
ansible-galaxy collection install kubernetes.core --upgrade

echo "==> Done. Tools:"
k3d version
packer version
ansible --version | head -1
