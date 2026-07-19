#!/usr/bin/env bash
#
# Installs the `pumlfmt` CLI (PlantUML formatter from plantuml-helpers)
# on Linux / macOS.
#
# Usage:
#   ./install.sh                # from a checkout of the repository
#   curl -fsSL https://raw.githubusercontent.com/michael72/plantuml-helpers/master/install.sh | bash
#
# Environment variables:
#   PUMLFMT_HOME  where to clone/build the sources when not run from a
#                 checkout (default: ~/.local/share/pumlfmt)
#   BIN_DIR       where to place the `pumlfmt` launcher
#                 (default: /usr/local/bin if writable, else ~/.local/bin)

set -euo pipefail

REPO_URL="https://github.com/michael72/plantuml-helpers.git"

log() { printf '%s\n' "$*"; }
die() { printf 'install.sh: error: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "node is required (https://nodejs.org, >= 20). On Ubuntu: apt-get install -y nodejs npm"
command -v npm >/dev/null 2>&1 || die "npm is required. On Ubuntu: apt-get install -y npm"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "node >= 20 is required (found $(node --version))"
fi

# Use the surrounding checkout if this script is run from within the
# repository, otherwise clone (or update) the sources.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" >/dev/null 2>&1 && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ] && grep -q '"name": "plantuml-helpers"' "$SCRIPT_DIR/package.json"; then
  SRC_DIR="$SCRIPT_DIR"
  log "Using sources in $SRC_DIR"
else
  SRC_DIR="${PUMLFMT_HOME:-$HOME/.local/share/pumlfmt}"
  command -v git >/dev/null 2>&1 || die "git is required to fetch the sources. On Ubuntu: apt-get install -y git"
  if [ -d "$SRC_DIR/.git" ]; then
    log "Updating sources in $SRC_DIR"
    git -C "$SRC_DIR" pull --ff-only
  else
    log "Cloning $REPO_URL to $SRC_DIR"
    mkdir -p "$(dirname "$SRC_DIR")"
    git clone --depth 1 "$REPO_URL" "$SRC_DIR"
  fi
fi

log "Installing dependencies..."
(cd "$SRC_DIR" && npm ci --no-audit --no-fund 2>/dev/null) \
  || (cd "$SRC_DIR" && npm install --no-audit --no-fund)

log "Compiling..."
(cd "$SRC_DIR" && npm run compile)

[ -f "$SRC_DIR/out/src/cli.js" ] || die "build did not produce out/src/cli.js"

# Pick the target directory for the launcher.
if [ -z "${BIN_DIR:-}" ]; then
  if [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
    BIN_DIR=/usr/local/bin
  else
    BIN_DIR="$HOME/.local/bin"
  fi
fi
mkdir -p "$BIN_DIR"

LAUNCHER="$BIN_DIR/pumlfmt"
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
exec node "$SRC_DIR/out/src/cli.js" "\$@"
EOF
chmod +x "$LAUNCHER"

log ""
log "Installed pumlfmt $(node "$SRC_DIR/out/src/cli.js" --version | awk '{print $2}') to $LAUNCHER"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) log "NOTE: $BIN_DIR is not on your PATH - add it, e.g.:"
     log "  export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac
log ""
log "Usage: pumlfmt <file.puml|file.md>           # auto-format arrow layout"
log "       pumlfmt --reset <file.puml|file.md>   # reset arrows to defaults"
