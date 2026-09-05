-- Runs once when the Compose MySQL data volume is first created.
CREATE DATABASE IF NOT EXISTS editorial;
CREATE DATABASE IF NOT EXISTS discussion;
CREATE DATABASE IF NOT EXISTS content_node_registry;
CREATE DATABASE IF NOT EXISTS identity;
GRANT ALL PRIVILEGES ON editorial.* TO 'wapps'@'%';
GRANT ALL PRIVILEGES ON discussion.* TO 'wapps'@'%';
GRANT ALL PRIVILEGES ON content_node_registry.* TO 'wapps'@'%';
GRANT ALL PRIVILEGES ON identity.* TO 'wapps'@'%';
