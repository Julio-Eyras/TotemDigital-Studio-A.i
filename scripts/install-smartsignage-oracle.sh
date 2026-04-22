#!/usr/bin/env bash
set -Eeuo pipefail

# Oracle Linux wrapper for install-smartsignage.sh
# - Keeps original script untouched
# - Generates an Oracle-compatible copy and executes it

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_SCRIPT="${SCRIPT_DIR}/install-smartsignage.sh"
TARGET_SCRIPT="${SCRIPT_DIR}/install-smartsignage-oracle.generated.sh"

if [[ ! -f "${SOURCE_SCRIPT}" ]]; then
  echo "Erro: script base não encontrado em ${SOURCE_SCRIPT}" >&2
  exit 1
fi

python3 - "${SOURCE_SCRIPT}" "${TARGET_SCRIPT}" <<'PY'
import re
import sys
from pathlib import Path

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
text = src.read_text(encoding="utf-8")

compat_block = r'''
# ================================
# Oracle Linux compatibility layer
# ================================
is_oracle_linux() {
    local _id="${ID:-}"
    local _like="${ID_LIKE:-}"
    [[ "$_id" == "ol" || "$_id" == "oracle" || "$_id" == "oraclelinux" || "$_id" == "rhel" || "$_id" == "rocky" || "$_id" == "almalinux" || "$_like" == *"rhel"* || "$_like" == *"fedora"* ]]
}

pkg_update() {
    if is_oracle_linux; then
        sudo dnf -y makecache
    else
        sudo apt update
    fi
}

pkg_upgrade() {
    if is_oracle_linux; then
        sudo dnf -y upgrade
    else
        sudo apt upgrade -y
    fi
}

ensure_oracle_postgres_service() {
    if ! is_oracle_linux; then
        return 0
    fi

    # Oracle/RHEL usa data dir padrão em /var/lib/pgsql/data
    if [[ ! -f "/var/lib/pgsql/data/PG_VERSION" ]] && command -v postgresql-setup >/dev/null 2>&1; then
        sudo postgresql-setup --initdb >/dev/null 2>&1 || true
    fi

    sudo systemctl enable postgresql >/dev/null 2>&1 || true
    sudo systemctl start postgresql >/dev/null 2>&1 || true
}

ensure_ffmpeg_oracle() {
    # 1) tentar dnf direto (caso repo já tenha ffmpeg)
    if sudo dnf -y install ffmpeg >/dev/null 2>&1; then
        return 0
    fi

    # 2) habilitar EPEL + RPM Fusion Free (EL9) e tentar novamente
    sudo dnf -y install oracle-epel-release-el9 >/dev/null 2>&1 || true
    sudo dnf -y install epel-release >/dev/null 2>&1 || true
    sudo dnf -y install "https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-9.noarch.rpm" >/dev/null 2>&1 || true
    if sudo dnf -y install ffmpeg >/dev/null 2>&1; then
        return 0
    fi

    # 3) fallback: binário estático (johnvansickle)
    local tmpdir
    tmpdir="$(mktemp -d /tmp/ffmpeg-static.XXXXXX)"
    if curl -fsSL "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" -o "${tmpdir}/ffmpeg.tar.xz"; then
        if tar -xJf "${tmpdir}/ffmpeg.tar.xz" -C "${tmpdir}" >/dev/null 2>&1; then
            local bindir
            bindir="$(find "${tmpdir}" -maxdepth 2 -type f -name ffmpeg -printf '%h\n' | head -1)"
            if [[ -n "$bindir" && -x "${bindir}/ffmpeg" ]]; then
                sudo install -m 0755 "${bindir}/ffmpeg" /usr/local/bin/ffmpeg
                if [[ -x "${bindir}/ffprobe" ]]; then
                    sudo install -m 0755 "${bindir}/ffprobe" /usr/local/bin/ffprobe
                fi
                rm -rf "${tmpdir}" >/dev/null 2>&1 || true
                return 0
            fi
        fi
    fi

    rm -rf "${tmpdir}" >/dev/null 2>&1 || true
    return 1
}

pkg_install() {
    local pkgs=("$@")
    if is_oracle_linux; then
        local out=()
        local optional_missing=("redhat-lsb-core" "htop")
        local includes_postgres_server=false
        for p in "${pkgs[@]}"; do
            case "$p" in
                apt-transport-https|software-properties-common|ufw) continue ;;
                build-essential) out+=("gcc" "gcc-c++" "make") ;;
                redis-server) out+=("redis") ;;
                postgresql-client) out+=("postgresql") ;;
                postgresql) out+=("postgresql" "postgresql-server") ; includes_postgres_server=true ;;
                postgresql-[0-9]*) out+=("postgresql" "postgresql-server") ; includes_postgres_server=true ;;
                postgresql-contrib) out+=("postgresql-contrib") ;;
                lsb-release) continue ;;
                python3-pip) out+=("python3-pip") ;;
                *) out+=("$p") ;;
            esac
        done
        if [[ ${#out[@]} -gt 0 ]]; then
            local failed_required=()
            for pkg in "${out[@]}"; do
                if ! sudo dnf -y install "$pkg"; then
                    if [[ "$pkg" == "ffmpeg" ]]; then
                        if ensure_ffmpeg_oracle; then
                            echo "[oracle-compat] ffmpeg instalado com fallback."
                            continue
                        fi
                        echo "[oracle-compat] Erro: ffmpeg é obrigatório e não pôde ser instalado." >&2
                        failed_required+=("$pkg")
                        continue
                    fi
                    local is_optional=false
                    for opt in "${optional_missing[@]}"; do
                        if [[ "$pkg" == "$opt" ]]; then
                            is_optional=true
                            break
                        fi
                    done
                    if [[ "$is_optional" == true ]]; then
                        echo "[oracle-compat] Aviso: pacote opcional não encontrado: $pkg"
                    else
                        failed_required+=("$pkg")
                    fi
                fi
            done
            if [[ ${#failed_required[@]} -gt 0 ]]; then
                echo "[oracle-compat] Erro: falha ao instalar pacotes obrigatórios: ${failed_required[*]}" >&2
                return 1
            fi
        fi
        if [[ "$includes_postgres_server" == true ]]; then
            ensure_oracle_postgres_service || true
        fi
    else
        sudo apt install -y "${pkgs[@]}"
    fi
}

firewall_cmd_compat() {
    if ! is_oracle_linux; then
        sudo ufw "$@"
        return
    fi

    local args=("$@")
    local first="${args[0]:-}"
    local second="${args[1]:-}"

    sudo systemctl enable --now firewalld >/dev/null 2>&1 || true

    if [[ "$first" == "--force" && "$second" == "enable" ]]; then
        sudo systemctl enable --now firewalld >/dev/null 2>&1 || true
        return
    fi
    if [[ "$first" == "--force" && "$second" == "reset" ]]; then
        sudo firewall-cmd --reload >/dev/null 2>&1 || true
        return
    fi
    if [[ "$first" == "reset" ]]; then
        sudo firewall-cmd --reload >/dev/null 2>&1 || true
        return
    fi
    if [[ "$first" == "default" ]]; then
        # firewalld não usa default deny/allow como ufw; ignorar com sucesso.
        return
    fi

    # ufw allow 22/tcp
    if [[ "$first" == "allow" && "${args[1]:-}" =~ ^[0-9]+/(tcp|udp)$ ]]; then
        sudo firewall-cmd --permanent --add-port="${args[1]}" >/dev/null
        sudo firewall-cmd --reload >/dev/null
        return
    fi

    # ufw allow from 192.168.0.0/16 to any port 5432
    if [[ "$first" == "allow" && "${args[1]:-}" == "from" ]]; then
        local net="${args[2]:-}"
        local port=""
        for i in "${!args[@]}"; do
            if [[ "${args[$i]}" == "port" ]]; then
                port="${args[$((i+1))]:-}"
                break
            fi
        done
        if [[ -n "$net" && -n "$port" ]]; then
            sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='${net}' port protocol='tcp' port='${port}' accept" >/dev/null
            sudo firewall-cmd --reload >/dev/null
            return
        fi
    fi

    # fallback silencioso para sintaxes não tratadas
    return 0
}

if ! command -v dpkg >/dev/null 2>&1; then
    dpkg() {
        if [[ "${1:-}" == "-l" ]]; then
            rpm -qa --qf "ii %-40{NAME} %{VERSION}-%{RELEASE}\n"
            return 0
        fi
        return 1
    }
fi
'''

if text.startswith("#!/"):
    nl = text.find("\n")
    text = text[: nl + 1] + compat_block + text[nl + 1 :]
else:
    text = compat_block + text

# aceitar Oracle Linux no check_os()
text = text.replace(
    'if [[ "$ID" != "ubuntu" ]]; then',
    'if [[ "$ID" != "ubuntu" && "$ID" != "ol" && "$ID" != "oracle" && "$ID" != "oraclelinux" && "$ID" != "rhel" ]]; then'
)

# detectar Oracle Linux explicitamente
text = text.replace(
    "        debian)\n            DISTRO_TYPE=\"debian\"\n            ;;\n        *)",
    "        debian)\n            DISTRO_TYPE=\"debian\"\n            ;;\n        ol|oracle|oraclelinux|rhel|rocky|almalinux)\n            DISTRO_TYPE=\"oracle\"\n            ;;\n        *)"
)

# apt -> pkg_* (somente formas usadas no script)
text = text.replace("sudo apt-get update -y", "pkg_update")
text = text.replace("sudo apt-get update", "pkg_update")
text = text.replace("sudo apt update -y", "pkg_update")
text = text.replace("sudo apt update", "pkg_update")
text = text.replace("sudo apt upgrade -y", "pkg_upgrade")
text = text.replace("sudo apt-get upgrade -y", "pkg_upgrade")
text = text.replace("sudo apt-get install -y", "pkg_install")
text = text.replace("sudo apt install -y", "pkg_install")

# ufw -> firewall compat
text = text.replace("sudo ufw", "firewall_cmd_compat")

# paths mais comuns no Oracle Linux
text = text.replace("/var/lib/postgresql", "/var/lib/pgsql")
text = text.replace("/var/lib/pgsql/${PG_VERSION}/main", "/var/lib/pgsql/data")
text = text.replace("/var/lib/pgsql/${PG_VERSION}", "/var/lib/pgsql")
text = text.replace("if command -v adduser &> /dev/null; then", "if command -v adduser &> /dev/null && ! is_oracle_linux; then")
text = text.replace("    manage_demo_seed_strategy", "    manage_demo_seed_strategy || warn \"⚠️  manage_demo_seed_strategy falhou (compat Oracle). Continuando...\"")

# Redis: pacote/serviço em Oracle Linux é "redis" (não redis-server)
text = text.replace("sudo systemctl enable redis-server", "sudo systemctl enable redis")
text = text.replace("systemctl is-active --quiet redis-server", "systemctl is-active --quiet redis")
text = text.replace("sudo systemctl start redis-server", "sudo systemctl start redis")
text = text.replace("sudo systemctl status redis-server", "sudo systemctl status redis")

# Oracle Linux: alguns trechos ainda usam path Debian de configuração
text = text.replace("/etc/postgresql/${PG_VERSION}/main", "/var/lib/pgsql/data")

# ensure_admin_user: forçar TCP+senha no Oracle para evitar auth ident
text = text.replace(
    "    if [[ -n \"${DATABASE_URL:-}\" && \"${DATABASE_URL}\" == postgresql://* ]]; then\n        psql_cmd=\"psql \\\"${DATABASE_URL}\\\"\"\n    elif command -v sudo >/dev/null 2>&1; then\n        psql_cmd=\"sudo -u postgres psql -d \\\"${target_db}\\\"\"\n    else\n        psql_cmd=\"psql -d \\\"${target_db}\\\"\"\n    fi\n",
    "    if is_oracle_linux; then\n        # Oracle Linux: evitar auth ident/peer do usuário da app.\n        # Executa como usuário postgres e fora do cwd do usuário para evitar avisos de permission denied.\n        psql_cmd=\"cd /tmp && sudo -u ${POSTGRES_USER:-postgres} psql -d \\\"${target_db}\\\"\"\n    elif [[ -n \"${DATABASE_URL:-}\" && \"${DATABASE_URL}\" == postgresql://* ]]; then\n        psql_cmd=\"psql \\\"${DATABASE_URL}\\\"\"\n    elif command -v sudo >/dev/null 2>&1; then\n        psql_cmd=\"sudo -u postgres psql -d \\\"${target_db}\\\"\"\n    else\n        psql_cmd=\"psql -d \\\"${target_db}\\\"\"\n    fi\n"
)

# Node.js no Oracle Linux: forçar Node 20+ (evitar Node 16 do repo padrão)
text = text.replace(
    "install_nodejs() {\n    log \"Instalando Node.js...\"\n    \n    # Detectar distribuição se ainda não foi detectada\n    if [[ -z \"$DISTRO_TYPE\" ]]; then\n        detect_distribution\n    fi\n",
    "install_nodejs() {\n    log \"Instalando Node.js...\"\n    \n    # Detectar distribuição se ainda não foi detectada\n    if [[ -z \"$DISTRO_TYPE\" ]]; then\n        detect_distribution\n    fi\n\n    if is_oracle_linux; then\n        log \"Oracle Linux detectado: instalando Node.js 20.x...\"\n\n        # Preferir stream modular oficial do OL/RHEL\n        sudo dnf -y module reset nodejs >/dev/null 2>&1 || true\n        if ! sudo dnf -y module enable nodejs:20 >/dev/null 2>&1; then\n            warn \"⚠️  Não foi possível habilitar módulo nodejs:20. Tentando instalação direta...\"\n        fi\n\n        if ! sudo dnf -y install nodejs >/dev/null 2>&1; then\n            error \"❌ Falha ao instalar Node.js via dnf no Oracle Linux\"\n            return 1\n        fi\n\n        if ! command -v node >/dev/null 2>&1; then\n            error \"❌ Node.js não encontrado após instalação\"\n            return 1\n        fi\n\n        local NODE_MAJOR\n        NODE_MAJOR=$(node --version | sed 's/^v//' | cut -d'.' -f1)\n        if [[ -z \"$NODE_MAJOR\" ]] || [[ \"$NODE_MAJOR\" -lt 18 ]]; then\n            error \"❌ Node.js insuficiente no Oracle Linux: $(node --version 2>/dev/null || echo 'N/A')\"\n            error \"❌ É necessário Node >= 18 (recomendado 20).\"\n            return 1\n        fi\n\n        if command -v npm >/dev/null 2>&1; then\n            local NPM_MAJOR\n            NPM_MAJOR=$(npm --version 2>/dev/null | cut -d'.' -f1 || echo 0)\n            if [[ -z \"$NPM_MAJOR\" ]] || [[ \"$NPM_MAJOR\" -lt 9 ]]; then\n                log \"Atualizando npm para versão compatível...\"\n                sudo npm install -g npm@10 >/dev/null 2>&1 || true\n            fi\n        fi\n\n        log \"✅ Node.js $(node --version) instalado com sucesso no Oracle Linux\"\n        if command -v npm >/dev/null 2>&1; then\n            log \"✅ NPM $(npm --version) instalado com sucesso\"\n        fi\n        return 0\n    fi\n"
)

# referência textual de ajuda
text = text.replace("sudo apt install -y python3 python3-pip", "sudo dnf install -y python3 python3-pip")
text = text.replace("sudo apt install -y nodejs", "sudo dnf install -y nodejs")

dst.write_text(text, encoding="utf-8")
PY

chmod +x "${TARGET_SCRIPT}"
echo "Script Oracle gerado em: ${TARGET_SCRIPT}"
exec "${TARGET_SCRIPT}" "$@"

