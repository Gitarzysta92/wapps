"""Prepare private, persistent alpha configuration on its deployment host."""
import argparse
import json
import os
from pathlib import Path
import secrets
import tempfile


def write_private(target, contents, mode=0o600, owner=None):
    with tempfile.NamedTemporaryFile(mode="w", dir=target.parent, delete=False) as output:
        temporary = Path(output.name)
        try:
            output.write(contents)
            output.flush()
            os.fchmod(output.fileno(), mode)
            if owner is not None:
                os.fchown(output.fileno(), owner, owner)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)


def prepare(directory, bundle, origin):
    if origin != "https://alpha.wapps.ai":
        raise ValueError("This configuration is restricted to the alpha origin")
    account = bundle["serviceAccount"]
    project = bundle["projectId"]
    if project.startswith("demo-") or account["project_id"] != project:
        raise ValueError("A matching real Firebase project is required")
    if not bundle["apiKey"] or not account.get("private_key"):
        raise ValueError("Firebase credentials are incomplete")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    secret_path = directory / "generated.json"
    if secret_path.exists():
        values = json.loads(secret_path.read_text())
    else:
        values = {key: secrets.token_urlsafe(48) for key in (
            "mysql", "mysqlRoot", "mongo", "rabbitmq", "minio", "ingress",
            "export", "erasure", "notification", "explore",
        )}
        write_private(secret_path, json.dumps(values))

    def write_env(name, env):
        if any("\n" in str(value) or "\r" in str(value) for value in env.values()):
            raise ValueError("Environment values must be single-line")
        target = directory / (name + ".env")
        write_private(target, "".join(key + "=" + str(value) + "\n" for key, value in sorted(env.items())))

    common = {"NODE_ENV": "production", "INGRESS_AUTH_SECRET": values["ingress"]}
    queue = {"QUEUE_HOST": "rabbitmq", "QUEUE_PORT": "5672", "QUEUE_USERNAME": "wapps", "QUEUE_PASSWORD": values["rabbitmq"]}
    mongo = {"MONGO_HOST": "mongodb", "MONGO_PORT": "27017", "MONGO_USERNAME": "wapps", "MONGO_PASSWORD": values["mongo"]}
    identity_db = {"MYSQL_HOST": "mysql", "MYSQL_PORT": "3306", "MYSQL_USERNAME": "wapps", "MYSQL_PASSWORD": values["mysql"], "MYSQL_DATABASE": "identity"}
    service_auth = {"ACCOUNT_EXPORT_SOURCE_SECRET": values["export"], "ACCOUNT_ERASURE_SECRET": values["erasure"], "NOTIFICATION_SERVICE_SECRET": values["notification"]}
    firebase = {"FIREBASE_PROJECT_ID": project, "FIREBASE_WEB_API_KEY": bundle["apiKey"], "GOOGLE_APPLICATION_CREDENTIALS": "/run/secrets/firebase.json"}
    policy = {"OPA_URL": "http://opa:8181"}
    editorial_db = {"EDITORIAL_DATABASE_HOST": "mysql", "EDITORIAL_DATABASE_PORT": "3306", "EDITORIAL_DATABASE_USERNAME": "wapps", "EDITORIAL_DATABASE_PASSWORD": values["mysql"], "EDITORIAL_DATABASE_NAME": "editorial"}
    discussion_db = {"DISCUSSION_DATABASE_HOST": "mysql", "DISCUSSION_DATABASE_PORT": "3306", "DISCUSSION_DATABASE_USERNAME": "wapps", "DISCUSSION_DATABASE_PASSWORD": values["mysql"], "DISCUSSION_DATABASE_NAME": "discussion"}
    discussion_storage = {"DISCUSSION_STORAGE_HOST": "http://minio:9000", "DISCUSSION_STORAGE_ACCESSKEY": "wapps", "DISCUSSION_STORAGE_SECRETKEY": values["minio"]}
    write_env("mysql", {"MYSQL_ROOT_PASSWORD": values["mysqlRoot"], "MYSQL_DATABASE": "editorial", "MYSQL_USER": "wapps", "MYSQL_PASSWORD": values["mysql"]})
    write_env("mongodb", {"MONGO_INITDB_ROOT_USERNAME": "wapps", "MONGO_INITDB_ROOT_PASSWORD": values["mongo"]})
    write_env("rabbitmq", {"RABBITMQ_DEFAULT_USER": "wapps", "RABBITMQ_DEFAULT_PASS": values["rabbitmq"]})
    write_env("minio", {"MINIO_ROOT_USER": "wapps", "MINIO_ROOT_PASSWORD": values["minio"]})
    editorial = {**common, **editorial_db, **queue, **mongo, **policy, **service_auth,
        "MONGO_DATABASE": "editorial", "EDITORIAL_PUBLIC_TENANT": "default",
        "EXPLORE_SERVICE_SECRET": values["explore"], "EDITORIAL_SEED_DEMO_DATA": "false",
        "EDITORIAL_ERASURE_WORKERS_FENCED": "true", "EDITORIAL_MEDIA_ENDPOINT": "http://minio:9000",
        "EDITORIAL_MEDIA_BUCKET": "application-images", "EDITORIAL_MEDIA_ACCESS_KEY": "wapps",
        "EDITORIAL_MEDIA_SECRET_KEY": values["minio"], "EDITORIAL_MEDIA_PUBLIC_ORIGIN": origin,
        "EDITORIAL_MEDIA_CLEANUP_ENABLED": "true", "EDITORIAL_HEALTH_MONITOR_ENABLED": "false"}
    write_env("editorial", editorial)
    write_env("editorial-materializer", {**editorial_db, **queue, **mongo, "NODE_ENV": "production", "MONGO_DATABASE": "editorial", "EDITORIAL_PUBLIC_TENANT": "default"})
    write_env("discussion-migrate", discussion_db)
    write_env("discussion", {**common, **discussion_db, **discussion_storage, **queue, **mongo, **policy, **service_auth,
        "MONGO_DATABASE": "discussion", "EDITORIAL_URL": "http://editorial:1337", "ACCOUNT_MANAGEMENT_URL": "http://account-management:1340",
        "DISCUSSION_PUBLIC_TENANT": "default", "DISCUSSION_SEED_DEMO_DATA": "false", "DISCUSSION_ERASURE_WORKERS_FENCED": "true",
        "EXPLORE_SERVICE_SECRET": values["explore"], "FIREBASE_PROJECT_ID": project})
    write_env("discussion-materializer", {**queue, **mongo, **discussion_storage, **identity_db,
        "NODE_ENV": "production", "MYSQL_DATABASE": "discussion", "MONGO_DATABASE": "discussion"})
    write_env("catalog-bff", {**common, "EXPLORE_SERVICE_SECRET": values["explore"], "FIREBASE_PROJECT_ID": project,
        "EDITORIAL_URL": "http://editorial:1337", "DISCUSSION_URL": "http://discussion:1338", "PORT": "3000"})
    write_env("identity-migrate", identity_db)
    write_env("account-management", {**common, **identity_db, **queue, **policy, **service_auth, **firebase,
        "ACCOUNT_MANAGEMENT_PORT": "1340", "ACCOUNT_MANAGEMENT_CORS_ORIGIN": origin,
        "EDITORIAL_URL": "http://editorial:1337", "DISCUSSION_URL": "http://discussion:1338",
        "REPLY_NOTIFICATION_WORKER_ENABLED": "true", "MENTION_NOTIFICATION_WORKER_ENABLED": "true", "FAVORITE_UPDATE_WORKER_ENABLED": "true"})
    write_env("firebase-auth-validator", {**common, **identity_db, **queue, **firebase,
        "PORT": "8080", "ALLOWED_ORIGINS": origin, "ENABLE_EMAIL_PASSWORD": "true",
        "ENABLE_GOOGLE": "false", "ENABLE_GITHUB": "false", "ENABLE_ANONYMOUS": "false"})
    target = directory / "firebase-service-account.json"
    write_private(target, json.dumps(account), 0o400, 1000 if os.geteuid() == 0 else None)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--firebase-bundle", type=Path, required=True)
    parser.add_argument("--origin", default="https://alpha.wapps.ai")
    args = parser.parse_args()
    prepare(args.directory, json.loads(args.firebase_bundle.read_text()), args.origin)
    print("Alpha configuration prepared; existing generated credentials retained")
