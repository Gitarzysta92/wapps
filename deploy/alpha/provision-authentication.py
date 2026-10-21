"""Provision the dedicated alpha credential schema without rotating existing users."""
import argparse
import json
from pathlib import Path
import re
import subprocess


def provision(directory, container, apply):
    values = json.loads((directory / "generated.json").read_text())
    password = values["authenticationMysql"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", password):
        raise ValueError("Invalid generated Authentication database credential")

    def sql(statement):
        result = subprocess.run(
            ["docker", "exec", "-i", container, "sh", "-c",
             'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --batch --skip-column-names'],
            input=statement, text=True, capture_output=True, check=False,
        )
        if result.returncode:
            raise RuntimeError("Authentication provisioning database operation failed")
        return result.stdout.strip()

    foreign_tables = sql("""SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = 'authentication' AND TABLE_NAME NOT IN
      ('migrations', 'local_credential_users', 'local_credential_sessions',
       'local_credential_enrollments', 'firebase_credential_enrollments');""")
    foreign_grants = sql("""SELECT PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES
      WHERE GRANTEE = CONCAT(CHAR(39), 'wapps_auth', CHAR(39), '@', CHAR(39), '%', CHAR(39))
      AND PRIVILEGE_TYPE <> 'USAGE'
      UNION ALL SELECT PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES
      WHERE GRANTEE = CONCAT(CHAR(39), 'wapps_auth', CHAR(39), '@', CHAR(39), '%', CHAR(39))
      AND TABLE_SCHEMA <> 'authentication'
      UNION ALL SELECT PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES
      WHERE GRANTEE = CONCAT(CHAR(39), 'wapps_auth', CHAR(39), '@', CHAR(39), '%', CHAR(39))
      AND TABLE_SCHEMA <> 'authentication';""")
    if foreign_tables or foreign_grants:
        raise RuntimeError("Existing Authentication schema/user has foreign ownership; review before applying")

    def verify_credentials():
        result = subprocess.run(
            ["docker", "exec", "-i", container, "sh", "-c",
             'read -r MYSQL_PWD; export MYSQL_PWD; exec mysql -h127.0.0.1 -uwapps_auth '
             '-D authentication --batch --skip-column-names -e "SELECT 1"'],
            input=password + "\n", text=True, capture_output=True, check=False,
        )
        if result.returncode or result.stdout.strip() != "1":
            raise RuntimeError("Existing Authentication database credential does not match; no rotation attempted")

    if sql("SELECT COUNT(*) FROM mysql.user WHERE User = 'wapps_auth' AND Host = '%';") == "1":
        verify_credentials()
    if not apply:
        print("Authentication schema/user preflight passed; no changes made")
        return
    sql("CREATE DATABASE IF NOT EXISTS authentication;\n"
        "CREATE USER IF NOT EXISTS 'wapps_auth'@'%' IDENTIFIED BY '" + password + "';\n"
        "GRANT ALL PRIVILEGES ON authentication.* TO 'wapps_auth'@'%';")
    verify_credentials()
    print("Authentication schema/user provisioned; existing credentials not rotated")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--container", default="wapps-alpha-mysql-1")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    provision(args.directory, args.container, args.apply)
