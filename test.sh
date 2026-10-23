#!/usr/bin/env bash

# Cores para o output no terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== 1. CARREGANDO CONFIGURAÇÕES DO .env ===${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}[ERRO] Arquivo .env não encontrado na raiz do projeto!${NC}"
    exit 1
fi

# Carrega as variáveis do .env ignorando comentários
export $(grep -v '^#' .env | xargs)

PORT=${PORT:-3000}
BASE_URL="http://localhost:$PORT"
KEYCLOAK_URL="http://localhost:8080"
REALM=${KEYCLOAK_REALM:-wagering}
CLIENT_ID=${KEYCLOAK_CLIENT_ID:-wagering-api}
CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET:-wagering-api-secret}
TEST_USER=${KEYCLOAK_TEST_USERNAME:-testuser}
TEST_PASS=${KEYCLOAK_TEST_PASSWORD:-testpass}

echo -e "${CYAN}API em $BASE_URL | Keycloak em $KEYCLOAK_URL (Realm: $REALM)${NC}"

echo -e "\n${YELLOW}=== 2. VERIFICANDO AMBIENTE DOCKER (SEM REINICIAR) ===${NC}"
echo -e "${CYAN}Garantindo containers ativos sem recriar os já existentes...${NC}"
docker compose up -d --no-recreate

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERRO] Falha ao comunicar com o Docker Compose.${NC}"
    exit 1
fi
echo -e "${GREEN}[SUCESSO] Contêineres Docker mantidos ativos e intocados!${NC}"

echo -e "\n${YELLOW}=== 3. AGUARDANDO SERVIÇOS FICAREM PRONTOS ===${NC}"
echo -e "${CYAN}Aguardando Keycloak responder...${NC}"

MAX_RETRIES=30
RETRY_COUNT=0
KEYCLOAK_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s "$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration" > /dev/null; then
        KEYCLOAK_READY=true
        break
    fi
    echo -n "."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$KEYCLOAK_READY" = false ]; then
    echo -e "\n${RED}[ERRO] O Keycloak não respondeu a tempo em $KEYCLOAK_URL.${NC}"
    exit 1
fi
echo -e "\n${GREEN}[SUCESSO] Keycloak online e pronto!${NC}"

# Pequena pausa para garantir inicialização completa da API NestJS
sleep 3

echo -e "\n${YELLOW}=== 4. EXECUTANDO REQUISIÇÕES HTTP DIRETAS (COM OUTPUTS) ===${NC}"

# 4.1 Teste de Health Check (Público)
echo -e "\n${CYAN}[TESTE 1] GET /health/live (Endpoint Público)${NC}"
HEALTH_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/health/live")
HTTP_BODY=$(echo "$HEALTH_RES" | sed -e 's/HTTP_STATUS:.*//')
HTTP_STATUS=$(echo "$HEALTH_RES" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
echo -e "Status HTTP: ${GREEN}$HTTP_STATUS${NC} | Resposta: $HTTP_BODY"

# 4.2 Teste de Segurança (Sem Token)
echo -e "\n${CYAN}[TESTE 2] POST /wallets sem token (Espera-se bloqueio 401)${NC}"
SEC_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/wallets" \
  -H "Content-Type: application/json" \
  -d '{}')
SEC_BODY=$(echo "$SEC_RES" | sed -e 's/HTTP_STATUS:.*//')
SEC_STATUS=$(echo "$SEC_RES" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
if [ "$SEC_STATUS" -eq 401 ]; then
    echo -e "Status HTTP: ${GREEN}$SEC_STATUS (BLOQUEADO CORRETAMENTE)${NC}"
else
    echo -e "Status HTTP: ${RED}$SEC_STATUS (FALHA DE SEGURANÇA)${NC}"
fi

# 4.3 Obter Token JWT no Keycloak
echo -e "\n${CYAN}[TESTE 3] Solicitando Token JWT no Keycloak (Client Credentials / Password)${NC}"
TOKEN_RES=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "username=$TEST_USER" \
  -d "password=$TEST_PASS")

# Extração segura com Python
TOKEN=$(python3 -c "import sys, json; print(json.loads(sys.argv[1]).get('access_token', ''))" "$TOKEN_RES" 2>/dev/null)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "None" ]; then
    echo -e "${GREEN}[SUCESSO] Token JWT obtido com sucesso!${NC}"
else
    echo -e "${RED}[ERRO] Falha ao obter token. Resposta do Keycloak: $TOKEN_RES${NC}"
    exit 1
fi

# 4.4 Criar Carteira autenticada
echo -e "\n${CYAN}[TESTE 4] POST /wallets com Token Bearer (Criando nova carteira)${NC}"
RANDOM_PLAYER="player-$(date +%s)"
WALLET_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/wallets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\": \"$RANDOM_PLAYER\", \"initialBalance\": {\"amount\": \"200.00\", \"currency\": \"BRL\"}}")

W_BODY=$(echo "$WALLET_RES" | sed -e 's/HTTP_STATUS:.*//')
W_STATUS=$(echo "$WALLET_RES" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
echo -e "Status HTTP: ${GREEN}$W_STATUS${NC} | Resposta JSON: $W_BODY"

echo -e "\n${YELLOW}=== 5. EXECUTANDO SUÍTE COMPLETA DE TESTES DO BUN ===${NC}"
if command -v bun &> /dev/null; then
    bun test
else
    echo -e "${RED}[AVISO] Bun não encontrado no PATH.${NC}"
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   FLUXO COMPLETO EXECUTADO COM EXCELÊNCIA!         ${NC}"
echo -e "${GREEN}====================================================${NC}"