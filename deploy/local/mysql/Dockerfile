FROM mysql:8.4

# Source the initializer with MySQL's helpers; host mount modes are not portable.
COPY --chmod=0644 02-authentication.sh /docker-entrypoint-initdb.d/02-authentication.sh
COPY --chmod=0644 init.sql /docker-entrypoint-initdb.d/10-wapps.sql
