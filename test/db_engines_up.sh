#!/usr/bin/env bash
# Start local test DB servers for the multi-engine e2e harness
# (test/e2e_engine.js). MySQL -> 127.0.0.1:3306 (fsmtest/fsmpass123),
# PostgreSQL -> 127.0.0.1:5433 (postgres/pgpass, Docker).
#
# MySQL uses the HOST-installed server (systemd); PostgreSQL uses Docker to
# avoid clashing with any host PG. Idempotent.
set -e

# --- MySQL (host, systemd) ---
if ! sudo systemctl is-active --quiet mysql; then
    sudo mkdir -p /var/log/mysql && sudo chown mysql:mysql /var/log/mysql
    sudo systemctl reset-failed mysql 2>/dev/null || true
    sudo systemctl start mysql
fi
for i in $(seq 1 30); do
    if mysqladmin -h 127.0.0.1 ping --silent 2>/dev/null \
       || sudo mysqladmin ping --silent 2>/dev/null; then break; fi
    sleep 1
done
sudo mysql -e "CREATE USER IF NOT EXISTS 'fsmtest'@'127.0.0.1' IDENTIFIED BY 'fsmpass123'; GRANT ALL PRIVILEGES ON *.* TO 'fsmtest'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;"

# --- PostgreSQL (Docker) ---
sudo docker start fsm-pgsql 2>/dev/null || sudo docker run -d --name fsm-pgsql -e POSTGRES_PASSWORD=*** -p 5433:5432 postgres:16
for i in $(seq 1 30); do
    if sudo docker exec fsm-pgsql pg_isready -U postgres -q 2>/dev/null; then break; fi
    sleep 1
done
# Ensure scram password matches the harness (fresh containers may init
# with trust-only for local and unset password for remote).
sudo docker exec fsm-pgsql psql -U postgres -c "ALTER USER postgres PASSWORD 'pgpass';" >/dev/null

echo "READY: mysql=127.0.0.1:3306(fsmtest) pgsql=127.0.0.1:5433(postgres)"
