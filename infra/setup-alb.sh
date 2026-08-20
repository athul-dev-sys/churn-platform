#!/usr/bin/env bash
# =============================================================================
# Idempotent ALB setup for churn-platform ECS Fargate services (ap-south-2)
#
# Path routing:
#   /api/*           -> churn-api            :3000
#   /predict*        -> churn-model-service  :8000
#   /*               -> churn-web            :80
#
# Usage:
#   chmod +x infra/setup-alb.sh
#   ./infra/setup-alb.sh
#   # optional overrides:
#   AWS_REGION=ap-south-2 CLUSTER=churn-platform-cluster ./infra/setup-alb.sh
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-ap-south-2}"
CLUSTER="${CLUSTER:-churn-platform-cluster}"
ALB_NAME="${ALB_NAME:-churn-platform-alb}"
TG_WEB_NAME="${TG_WEB_NAME:-churn-web-tg}"
TG_API_NAME="${TG_API_NAME:-churn-api-tg}"
TG_MODEL_NAME="${TG_MODEL_NAME:-churn-model-tg}"
ALB_SG_NAME="${ALB_SG_NAME:-churn-alb-sg}"

WEB_SERVICE="${WEB_SERVICE:-churn-web}"
API_SERVICE="${API_SERVICE:-churn-api}"
MODEL_SERVICE="${MODEL_SERVICE:-churn-model-service}"

WEB_CONTAINER="${WEB_CONTAINER:-churn-web}"
API_CONTAINER="${API_CONTAINER:-churn-api}"
MODEL_CONTAINER="${MODEL_CONTAINER:-churn-model-service}"

echo "==> Region=$REGION Cluster=$CLUSTER"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required"; exit 1; }
}
require_cmd aws
require_cmd jq

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
echo "==> Account=$ACCOUNT_ID"

# -----------------------------------------------------------------------------
# Discover VPC / subnets / security groups from an existing ECS service
# -----------------------------------------------------------------------------
echo "==> Discovering network config from ECS service: $WEB_SERVICE"
SVC_JSON=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$WEB_SERVICE" \
  --region "$REGION" \
  --output json)

SVC_STATUS=$(echo "$SVC_JSON" | jq -r '.services[0].status // empty')
if [[ -z "$SVC_STATUS" || "$SVC_STATUS" == "INACTIVE" ]]; then
  echo "ERROR: ECS service '$WEB_SERVICE' not found/active in cluster '$CLUSTER'"
  exit 1
fi

SUBNETS=$(echo "$SVC_JSON" | jq -r '.services[0].networkConfiguration.awsvpcConfiguration.subnets | join(",")')
TASK_SGS=$(echo "$SVC_JSON" | jq -r '.services[0].networkConfiguration.awsvpcConfiguration.securityGroups | join(",")')
ASSIGN_PUBLIC_IP=$(echo "$SVC_JSON" | jq -r '.services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp // "ENABLED"')

if [[ -z "$SUBNETS" || "$SUBNETS" == "null" ]]; then
  echo "ERROR: Could not read subnets from $WEB_SERVICE"
  exit 1
fi

FIRST_SUBNET=$(echo "$SUBNETS" | cut -d',' -f1)
VPC_ID=$(aws ec2 describe-subnets \
  --subnet-ids "$FIRST_SUBNET" \
  --region "$REGION" \
  --query 'Subnets[0].VpcId' \
  --output text)

# Prefer at least 2 subnets in different AZs for ALB
mapfile -t SUBNET_ARR < <(echo "$SUBNETS" | tr ',' '\n' | sed '/^\s*$/d')
if [[ ${#SUBNET_ARR[@]} -lt 2 ]]; then
  echo "==> Fewer than 2 subnets on service; discovering public subnets in VPC $VPC_ID"
  SUBNETS=$(aws ec2 describe-subnets \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[].SubnetId' \
    --output text | tr '\t' ',')
  mapfile -t SUBNET_ARR < <(echo "$SUBNETS" | tr ',' '\n' | sed '/^\s*$/d')
fi

# Deduplicate and take up to 2–3 subnets spanning AZs
ALB_SUBNETS=$(aws ec2 describe-subnets \
  --subnet-ids ${SUBNET_ARR[*]} \
  --region "$REGION" \
  --query 'Subnets | sort_by(@, &AvailabilityZone) | [].SubnetId' \
  --output text | tr '\t' '\n' | awk '!seen[$0]++' | head -n 3 | paste -sd',' -)

echo "    VPC=$VPC_ID"
echo "    ALB subnets=$ALB_SUBNETS"
echo "    Task SGs=$TASK_SGS"
echo "    assignPublicIp=$ASSIGN_PUBLIC_IP"

# -----------------------------------------------------------------------------
# Security group for ALB
# -----------------------------------------------------------------------------
echo "==> Ensuring ALB security group ($ALB_SG_NAME)"
EXISTING_ALB_SG=$(aws ec2 describe-security-groups \
  --region "$REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=$ALB_SG_NAME" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || true)

if [[ -z "$EXISTING_ALB_SG" || "$EXISTING_ALB_SG" == "None" ]]; then
  ALB_SG_ID=$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name "$ALB_SG_NAME" \
    --description "ALB ingress for churn-platform" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' \
    --output text)
  echo "    Created $ALB_SG_ID"
else
  ALB_SG_ID="$EXISTING_ALB_SG"
  echo "    Reusing $ALB_SG_ID"
fi

# Allow HTTP from internet
aws ec2 authorize-security-group-ingress \
  --region "$REGION" \
  --group-id "$ALB_SG_ID" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0 2>/dev/null || true

# Allow ALB -> task ports on each task security group
IFS=',' read -ra SG_ARR <<< "$TASK_SGS"
for SG in "${SG_ARR[@]}"; do
  [[ -z "$SG" || "$SG" == "None" ]] && continue
  for PORT in 80 3000 8000; do
    aws ec2 authorize-security-group-ingress \
      --region "$REGION" \
      --group-id "$SG" \
      --protocol tcp --port "$PORT" \
      --source-group "$ALB_SG_ID" 2>/dev/null || true
  done
done

# -----------------------------------------------------------------------------
# Helper: get-or-create target group (IP mode for Fargate/awsvpc)
# -----------------------------------------------------------------------------
ensure_tg() {
  local name="$1" port="$2" health_path="$3" health_port="${4:-traffic-port}"
  local arn
  arn=$(aws elbv2 describe-target-groups \
    --region "$REGION" \
    --names "$name" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null || true)

  if [[ -z "$arn" || "$arn" == "None" ]]; then
    echo "    Creating target group $name (port $port)" >&2
    arn=$(aws elbv2 create-target-group \
      --region "$REGION" \
      --name "$name" \
      --protocol HTTP \
      --port "$port" \
      --vpc-id "$VPC_ID" \
      --target-type ip \
      --health-check-protocol HTTP \
      --health-check-path "$health_path" \
      --health-check-port "$health_port" \
      --health-check-interval-seconds 30 \
      --healthy-threshold-count 2 \
      --unhealthy-threshold-count 3 \
      --matcher HttpCode=200 \
      --query 'TargetGroups[0].TargetGroupArn' \
      --output text)
  else
    echo "    Reusing target group $name" >&2
  fi
  printf '%s\n' "$arn"
}

echo "==> Ensuring target groups"
TG_WEB_ARN=$(ensure_tg "$TG_WEB_NAME" 80 "/" traffic-port)
TG_API_ARN=$(ensure_tg "$TG_API_NAME" 3000 "/health" traffic-port)
TG_MODEL_ARN=$(ensure_tg "$TG_MODEL_NAME" 8000 "/health" traffic-port)

# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------
echo "==> Ensuring Application Load Balancer ($ALB_NAME)"
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --region "$REGION" \
  --names "$ALB_NAME" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || true)

if [[ -z "$ALB_ARN" || "$ALB_ARN" == "None" ]]; then
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --region "$REGION" \
    --name "$ALB_NAME" \
    --type application \
    --scheme internet-facing \
    --ip-address-type ipv4 \
    --subnets $(echo "$ALB_SUBNETS" | tr ',' ' ') \
    --security-groups "$ALB_SG_ID" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)
  echo "    Created $ALB_ARN"
else
  echo "    Reusing $ALB_ARN"
  # Keep SG attached
  aws elbv2 set-security-groups \
    --region "$REGION" \
    --load-balancer-arn "$ALB_ARN" \
    --security-groups "$ALB_SG_ID" >/dev/null
fi

echo "==> Waiting for ALB to become active..."
aws elbv2 wait load-balancer-available --region "$REGION" --load-balancer-arns "$ALB_ARN"

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region "$REGION" \
  --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# -----------------------------------------------------------------------------
# HTTP listener + path-based rules
# -----------------------------------------------------------------------------
echo "==> Ensuring listener and rules"
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --region "$REGION" \
  --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[?Port==`80`].ListenerArn | [0]' \
  --output text 2>/dev/null || true)

if [[ -z "$LISTENER_ARN" || "$LISTENER_ARN" == "None" ]]; then
  LISTENER_ARN=$(aws elbv2 create-listener \
    --region "$REGION" \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP \
    --port 80 \
    --default-actions "Type=forward,TargetGroupArn=$TG_WEB_ARN" \
    --query 'Listeners[0].ListenerArn' \
    --output text)
  echo "    Created listener $LISTENER_ARN"
else
  echo "    Reusing listener $LISTENER_ARN"
  aws elbv2 modify-listener \
    --region "$REGION" \
    --listener-arn "$LISTENER_ARN" \
    --default-actions "Type=forward,TargetGroupArn=$TG_WEB_ARN" >/dev/null
fi

# Remove existing custom rules (keep default) then recreate for idempotency
EXISTING_RULE_ARNS=$(aws elbv2 describe-rules \
  --region "$REGION" \
  --listener-arn "$LISTENER_ARN" \
  --query 'Rules[?IsDefault==`false`].RuleArn' \
  --output text)
if [[ -n "$EXISTING_RULE_ARNS" && "$EXISTING_RULE_ARNS" != "None" ]]; then
  for R in $EXISTING_RULE_ARNS; do
    aws elbv2 delete-rule --region "$REGION" --rule-arn "$R" >/dev/null || true
  done
fi

# Priority 10: /api/*
aws elbv2 create-rule \
  --region "$REGION" \
  --listener-arn "$LISTENER_ARN" \
  --priority 10 \
  --conditions 'Field=path-pattern,Values=/api/*' \
  --actions "Type=forward,TargetGroupArn=$TG_API_ARN" >/dev/null

# Priority 20: /predict and /predict-batch (model service)
aws elbv2 create-rule \
  --region "$REGION" \
  --listener-arn "$LISTENER_ARN" \
  --priority 20 \
  --conditions 'Field=path-pattern,Values=/predict*' \
  --actions "Type=forward,TargetGroupArn=$TG_MODEL_ARN" >/dev/null

echo "    Rules: /api/* -> api, /predict* -> model, default /* -> web"

# -----------------------------------------------------------------------------
# Attach ECS services to target groups (preserve network config)
# -----------------------------------------------------------------------------
attach_service() {
  local service="$1" tg_arn="$2" container="$3" port="$4"
  echo "==> Attaching ECS service '$service' -> $container:$port"

  local desired task_def
  local desc
  desc=$(aws ecs describe-services --cluster "$CLUSTER" --services "$service" --region "$REGION" --output json)
  desired=$(echo "$desc" | jq -r '.services[0].desiredCount // 1')
  task_def=$(echo "$desc" | jq -r '.services[0].taskDefinition')

  # Try in-place update (supported on modern ECS)
  if aws ecs update-service \
    --region "$REGION" \
    --cluster "$CLUSTER" \
    --service "$service" \
    --task-definition "$task_def" \
    --desired-count "$desired" \
    --health-check-grace-period-seconds 120 \
    --load-balancers "targetGroupArn=$tg_arn,containerName=$container,containerPort=$port" \
    --network-configuration "awsvpcConfiguration={subnets=[$(echo "$SUBNETS" | sed 's/,/,/g')],securityGroups=[$(echo "$TASK_SGS" | sed 's/,/,/g')],assignPublicIp=$ASSIGN_PUBLIC_IP}" \
    --force-new-deployment >/dev/null 2> /tmp/ecs-update-err.txt; then
    echo "    Updated service $service with load balancer"
    return 0
  fi

  echo "    update-service with LB failed; recreating service..."
  cat /tmp/ecs-update-err.txt || true

  aws ecs delete-service --region "$REGION" --cluster "$CLUSTER" --service "$service" --force >/dev/null
  echo "    Waiting for service deletion..."
  for i in $(seq 1 60); do
    st=$(aws ecs describe-services --cluster "$CLUSTER" --services "$service" --region "$REGION" \
      --query 'services[0].status' --output text 2>/dev/null || echo "MISSING")
    if [[ "$st" == "INACTIVE" || "$st" == "MISSING" || "$st" == "None" ]]; then
      break
    fi
    sleep 5
  done

  aws ecs create-service \
    --region "$REGION" \
    --cluster "$CLUSTER" \
    --service-name "$service" \
    --task-definition "$task_def" \
    --desired-count "$desired" \
    --launch-type FARGATE \
    --platform-version LATEST \
    --health-check-grace-period-seconds 120 \
    --network-configuration "awsvpcConfiguration={subnets=[$(echo "$SUBNETS")],securityGroups=[$(echo "$TASK_SGS")],assignPublicIp=$ASSIGN_PUBLIC_IP}" \
    --load-balancers "targetGroupArn=$tg_arn,containerName=$container,containerPort=$port" \
    --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50" >/dev/null

  echo "    Recreated service $service"
}

attach_service "$WEB_SERVICE" "$TG_WEB_ARN" "$WEB_CONTAINER" 80
attach_service "$API_SERVICE" "$TG_API_ARN" "$API_CONTAINER" 3000
attach_service "$MODEL_SERVICE" "$TG_MODEL_ARN" "$MODEL_CONTAINER" 8000

# Persist outputs for deploy / secrets
OUT_FILE="$(cd "$(dirname "$0")" && pwd)/alb-outputs.env"
cat > "$OUT_FILE" <<EOF
ALB_DNS=$ALB_DNS
ALB_URL=http://$ALB_DNS
MODEL_SERVICE_URL=http://$ALB_DNS
FRONTEND_URL=http://$ALB_DNS
AWS_REGION=$REGION
CLUSTER=$CLUSTER
TG_WEB_ARN=$TG_WEB_ARN
TG_API_ARN=$TG_API_ARN
TG_MODEL_ARN=$TG_MODEL_ARN
ALB_ARN=$ALB_ARN
EOF

echo ""
echo "============================================================"
echo " PERMANENT PLATFORM URL (submit this):"
echo " http://$ALB_DNS"
echo "============================================================"
echo " Routing:"
echo "   http://$ALB_DNS/          -> churn-web"
echo "   http://$ALB_DNS/api/*     -> churn-api"
echo "   http://$ALB_DNS/predict*  -> churn-model-service"
echo ""
echo " Next:"
echo "   1. Set GitHub secret MODEL_SERVICE_URL=http://$ALB_DNS"
echo "   2. Set GitHub secret FRONTEND_URL=http://$ALB_DNS  (optional CORS)"
echo "   3. Push to main (or re-run deploy workflow)"
echo " Outputs written to: $OUT_FILE"
echo "============================================================"
