# DNS Configuration

This directory contains Ansible playbooks and templates for configuring DNS resolution using dnsmasq and systemd-resolved.

## Files

- `install.yml` - Main Ansible playbook for DNS setup
- `templates/` - Jinja2 templates for configuration files
  - `dnsmasq-loopback.conf.j2` - dnsmasq configuration for loopback interface
  - `dnsmasq-main.conf.j2` - Main dnsmasq configuration
  - `systemd-resolved-dnsmasq.conf.j2` - systemd-resolved configuration

## Configuration

The DNS setup creates a wildcard DNS resolution for `{{ target_env }}.wapps.ai` domains that resolves to `{{ target_ip }}`.

### Key Features

- Uses dnsmasq on port 5353 to avoid conflicts with systemd-resolved
- Binds only to loopback interface (`lo`)
- Forwards other queries to upstream DNS servers (1.1.1.1, 9.9.9.9)
- Integrates with systemd-resolved for seamless DNS resolution

### Fixed Issues

- Removed conflicting `bind-dynamic` directive that was causing "illegal repeated keyword" error
- Separated configuration into template files for better maintainability
- Used proper `interface=lo` binding instead of `bind-dynamic`

## Usage

Run the playbook with required variables:

```bash
ansible-playbook -i inventory.ini install.yml -e target_env=dev -e target_ip=192.168.1.100
```

## Variables

- `target_env` - Environment name (e.g., dev, staging, prod)
- `target_ip` - IP address to resolve wildcard domains to
