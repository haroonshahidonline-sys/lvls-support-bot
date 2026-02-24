#!/bin/bash
set -e

# ============================================================
# LVL'S Support Bot — VPS Deployment Script
# ============================================================
# Usage:
#   First time:  ./deploy.sh setup
#   Update bot:  ./deploy.sh update
#   View logs:   ./deploy.sh logs
#   Restart:     ./deploy.sh restart
#   Stop:        ./deploy.sh stop
#   Status:      ./deploy.sh status
#   Seed DB:     ./deploy.sh seed
# ============================================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

case "${1:-help}" in
  setup)
    echo "=========================================="
    echo "  LVL'S Support Bot — First Time Setup"
    echo "=========================================="

    # Check .env exists
    if [ ! -f .env ]; then
      echo ""
      echo "ERROR: .env file not found!"
      echo "Copy .env.example to .env and fill in your values:"
      echo "  cp .env.example .env"
      echo "  nano .env"
      exit 1
    fi

    echo ""
    echo "1. Building and starting all services..."
    docker compose up -d --build

    echo ""
    echo "2. Waiting for database to be ready..."
    sleep 5

    echo ""
    echo "3. Running database seed..."
    docker compose exec bot node -e "
      require('./dist/database/connection.js').testConnection().then(() => {
        return require('./dist/database/migrate.js').runMigrations();
      }).then(() => {
        console.log('Migrations complete');
        process.exit(0);
      }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    "

    # Run seed via a temporary container
    docker compose run --rm bot node -e "
      const { testConnection } = require('./dist/database/connection.js');
      const { runMigrations } = require('./dist/database/migrate.js');
      async function run() {
        await testConnection();
        await runMigrations();
        console.log('DB ready');
      }
      run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    " 2>/dev/null || true

    echo ""
    echo "=========================================="
    echo "  Bot is running!"
    echo "=========================================="
    echo ""
    echo "  View logs:    ./deploy.sh logs"
    echo "  Seed team:    ./deploy.sh seed"
    echo "  Stop:         ./deploy.sh stop"
    echo "  Status:       ./deploy.sh status"
    echo ""
    ;;

  update)
    echo "Pulling latest code and rebuilding..."
    git pull 2>/dev/null || echo "(not a git repo, skipping pull)"
    docker compose up -d --build
    echo "Updated and restarted."
    ;;

  logs)
    docker compose logs -f --tail=100 bot
    ;;

  logs-all)
    docker compose logs -f --tail=50
    ;;

  restart)
    docker compose restart bot
    echo "Bot restarted."
    ;;

  stop)
    docker compose down
    echo "All services stopped."
    ;;

  status)
    docker compose ps
    ;;

  seed)
    echo "Running seed (team members + channels)..."
    docker compose exec bot node -e "
      import('./dist/database/connection.js').then(({ testConnection }) =>
        testConnection()
      ).then(() =>
        import('./dist/database/migrate.js').then(({ runMigrations }) => runMigrations())
      ).then(() => {
        console.log('Seed would run here — use tsx scripts/seed-team.ts locally');
        process.exit(0);
      }).catch(e => { console.error(e); process.exit(1); });
    " 2>/dev/null || echo "Note: For full seeding, run 'npm run seed' locally before deploying."
    ;;

  rebuild)
    echo "Full rebuild (no cache)..."
    docker compose build --no-cache
    docker compose up -d
    echo "Rebuilt and restarted."
    ;;

  help|*)
    echo "LVL'S Support Bot — Deployment Commands"
    echo ""
    echo "  ./deploy.sh setup     First time setup (build + start)"
    echo "  ./deploy.sh update    Pull + rebuild + restart"
    echo "  ./deploy.sh logs      Follow bot logs"
    echo "  ./deploy.sh logs-all  Follow all service logs"
    echo "  ./deploy.sh restart   Restart the bot"
    echo "  ./deploy.sh stop      Stop everything"
    echo "  ./deploy.sh status    Show service status"
    echo "  ./deploy.sh seed      Seed database"
    echo "  ./deploy.sh rebuild   Full rebuild (no cache)"
    echo ""
    ;;
esac
