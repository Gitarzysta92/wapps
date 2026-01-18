#!/bin/bash
# Fix MySQL wapps_app user access from localhost
# This script creates the user for localhost if it only exists for '%'

set -e

echo "🔍 Checking MySQL user configuration..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run with sudo"
    exit 1
fi

# Default passwords (update if different)
ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
WAPPS_PASSWORD="${MYSQL_WAPPS_PASSWORD:-wapps_password}"

echo "📋 Current wapps_app users:"
mysql -u root -p"$ROOT_PASSWORD" -e "SELECT user, host FROM mysql.user WHERE user='wapps_app';" 2>/dev/null || {
    echo "❌ Cannot connect as root. Please check root password."
    exit 1
}

echo ""
echo "🔧 Creating/updating wapps_app@localhost user..."

# Create user for localhost with same privileges
mysql -u root -p"$ROOT_PASSWORD" <<SQL
-- Create user for localhost if it doesn't exist
CREATE USER IF NOT EXISTS 'wapps_app'@'localhost' IDENTIFIED BY '$WAPPS_PASSWORD';

-- Grant privileges on all databases
GRANT ALL PRIVILEGES ON editorial_dev.* TO 'wapps_app'@'localhost';
GRANT ALL PRIVILEGES ON editorial_staging.* TO 'wapps_app'@'localhost';
GRANT ALL PRIVILEGES ON editorial_prod.* TO 'wapps_app'@'localhost';
GRANT ALL PRIVILEGES ON catalog_dev.* TO 'wapps_app'@'localhost';
GRANT ALL PRIVILEGES ON catalog_staging.* TO 'wapps_app'@'localhost';
GRANT ALL PRIVILEGES ON catalog_prod.* TO 'wapps_app'@'localhost';

-- Ensure user exists for '%' as well (for cluster access)
CREATE USER IF NOT EXISTS 'wapps_app'@'%' IDENTIFIED BY '$WAPPS_PASSWORD';

-- Grant privileges for '%' host
GRANT ALL PRIVILEGES ON editorial_dev.* TO 'wapps_app'@'%';
GRANT ALL PRIVILEGES ON editorial_staging.* TO 'wapps_app'@'%';
GRANT ALL PRIVILEGES ON editorial_prod.* TO 'wapps_app'@'%';
GRANT ALL PRIVILEGES ON catalog_dev.* TO 'wapps_app'@'%';
GRANT ALL PRIVILEGES ON catalog_staging.* TO 'wapps_app'@'%';
GRANT ALL PRIVILEGES ON catalog_prod.* TO 'wapps_app'@'%';

FLUSH PRIVILEGES;
SQL

echo "✅ User configuration updated!"

echo ""
echo "📋 Verifying users:"
mysql -u root -p"$ROOT_PASSWORD" -e "SELECT user, host FROM mysql.user WHERE user='wapps_app';"

echo ""
echo "🧪 Testing connection from localhost:"
mysql -u wapps_app -p"$WAPPS_PASSWORD" -h localhost -e "SELECT USER(), CURRENT_USER(), 'Connection successful!' as status;" editorial_dev && {
    echo "✅ Connection from localhost works!"
} || {
    echo "❌ Connection still fails. Please check the password."
    exit 1
}

echo ""
echo "✅ All done! You can now connect as wapps_app from localhost."