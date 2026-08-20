# =============================================================================
# Idempotent ALB setup for churn-platform ECS Fargate (ap-south-2)
#
# Path routing:
#   /api/*      -> churn-api           :3000
#   /predict*   -> churn-model-service :8000
#   /*          -> churn-web           :80
#
# Usage (PowerShell from repo root):
#   cd churn-platform
#   .\infra\setup-alb.ps1
# =============================================================================
[CmdletBinding()]
param(
  [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-2" }),
  [string]$Cluster = "churn-platform-cluster",
  [string]$AlbName = "churn-platform-alb",
  [string]$WebService = "churn-web",
  [string]$ApiService = "churn-api",
  [string]$ModelService = "churn-model-service"
)

$ErrorActionPreference = "Stop"

function Require-Aws {
  if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI is required. Install: https://aws.amazon.com/cli/"
  }
}

function Aws-Json([string[]]$AwsArgs) {
  $raw = & aws @AwsArgs --region $Region --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($raw | Out-String)
  }
  if ([string]::IsNullOrWhiteSpace(($raw | Out-String).Trim())) { return $null }
  return ($raw | Out-String | ConvertFrom-Json)
}

function Aws-Text([string[]]$AwsArgs) {
  $raw = & aws @AwsArgs --region $Region --output text 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($raw | Out-String)
  }
  return (($raw | Out-String).Trim())
}

function Try-AwsText([string[]]$AwsArgs) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $raw = & aws @AwsArgs --region $Region --output text 2>$null
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) { return $null }
  $t = (($raw | Out-String).Trim())
  if ($t -eq "None" -or $t -eq "null") { return $null }
  return $t
}

Require-Aws
Write-Host "==> Region=$Region Cluster=$Cluster"

$account = Aws-Text @("sts", "get-caller-identity", "--query", "Account")
Write-Host "==> Account=$account"

# Discover network from web service
Write-Host "==> Discovering network config from $WebService"
$svc = Aws-Json @("ecs", "describe-services", "--cluster", $Cluster, "--services", $WebService)
if (-not $svc.services -or $svc.services.Count -eq 0 -or $svc.services[0].status -eq "INACTIVE") {
  throw "ECS service '$WebService' not found/active in cluster '$Cluster'"
}

$net = $svc.services[0].networkConfiguration.awsvpcConfiguration
$subnets = @($net.subnets)
$taskSgs = @($net.securityGroups)
$assignPublicIp = if ($net.assignPublicIp) { $net.assignPublicIp } else { "ENABLED" }

$vpcId = Aws-Text @("ec2", "describe-subnets", "--subnet-ids", $subnets[0], "--query", "Subnets[0].VpcId")
Write-Host "    VPC=$vpcId"
Write-Host "    Subnets=$($subnets -join ',')"
Write-Host "    Task SGs=$($taskSgs -join ',')"

if ($subnets.Count -lt 2) {
  Write-Host "==> Discovering additional subnets in VPC"
  $all = Aws-Json @("ec2", "describe-subnets", "--filters", "Name=vpc-id,Values=$vpcId")
  $subnets = @($all.Subnets | Sort-Object AvailabilityZone | Select-Object -ExpandProperty SubnetId -Unique | Select-Object -First 3)
}

$albSubnets = @($subnets | Select-Object -First 3)

# ALB security group
Write-Host "==> Ensuring ALB security group churn-alb-sg"
$albSgId = Try-AwsText @(
  "ec2", "describe-security-groups",
  "--filters", "Name=vpc-id,Values=$vpcId", "Name=group-name,Values=churn-alb-sg",
  "--query", "SecurityGroups[0].GroupId"
)
if (-not $albSgId) {
  $albSgId = Aws-Text @(
    "ec2", "create-security-group",
    "--group-name", "churn-alb-sg",
    "--description", "ALB ingress for churn-platform",
    "--vpc-id", $vpcId,
    "--query", "GroupId"
  )
  Write-Host "    Created $albSgId"
} else {
  Write-Host "    Reusing $albSgId"
}

& aws ec2 authorize-security-group-ingress --region $Region --group-id $albSgId --protocol tcp --port 80 --cidr 0.0.0.0/0 2>$null | Out-Null

foreach ($sg in $taskSgs) {
  foreach ($port in @(80, 3000, 8000)) {
    & aws ec2 authorize-security-group-ingress --region $Region --group-id $sg --protocol tcp --port $port --source-group $albSgId 2>$null | Out-Null
  }
}

function Ensure-TargetGroup([string]$Name, [int]$Port, [string]$HealthPath) {
  $arn = Try-AwsText @("elbv2", "describe-target-groups", "--names", $Name, "--query", "TargetGroups[0].TargetGroupArn")
  if (-not $arn) {
    Write-Host "    Creating target group $Name"
    $arn = Aws-Text @(
      "elbv2", "create-target-group",
      "--name", $Name,
      "--protocol", "HTTP",
      "--port", "$Port",
      "--vpc-id", $vpcId,
      "--target-type", "ip",
      "--health-check-protocol", "HTTP",
      "--health-check-path", $HealthPath,
      "--health-check-interval-seconds", "30",
      "--healthy-threshold-count", "2",
      "--unhealthy-threshold-count", "3",
      "--matcher", "HttpCode=200",
      "--query", "TargetGroups[0].TargetGroupArn"
    )
  } else {
    Write-Host "    Reusing target group $Name"
  }
  return $arn
}

Write-Host "==> Ensuring target groups"
$tgWeb = Ensure-TargetGroup "churn-web-tg" 80 "/"
$tgApi = Ensure-TargetGroup "churn-api-tg" 3000 "/health"
$tgModel = Ensure-TargetGroup "churn-model-tg" 8000 "/health"

Write-Host "==> Ensuring Application Load Balancer $AlbName"
$albArn = Try-AwsText @("elbv2", "describe-load-balancers", "--names", $AlbName, "--query", "LoadBalancers[0].LoadBalancerArn")
if (-not $albArn) {
  $createArgs = @(
    "elbv2", "create-load-balancer",
    "--name", $AlbName,
    "--type", "application",
    "--scheme", "internet-facing",
    "--ip-address-type", "ipv4",
    "--subnets"
  ) + $albSubnets + @(
    "--security-groups", $albSgId,
    "--query", "LoadBalancers[0].LoadBalancerArn"
  )
  $albArn = Aws-Text $createArgs
  Write-Host "    Created $albArn"
} else {
  Write-Host "    Reusing $albArn"
  & aws elbv2 set-security-groups --region $Region --load-balancer-arn $albArn --security-groups $albSgId | Out-Null
}

Write-Host "==> Waiting for ALB available..."
& aws elbv2 wait load-balancer-available --region $Region --load-balancer-arns $albArn
$albDns = Aws-Text @("elbv2", "describe-load-balancers", "--load-balancer-arns", $albArn, "--query", "LoadBalancers[0].DNSName")

Write-Host "==> Ensuring listener + path rules"
$listenerArn = Try-AwsText @(
  "elbv2", "describe-listeners",
  "--load-balancer-arn", $albArn,
  "--query", "Listeners[?Port==``80``].ListenerArn | [0]"
)
# JMESPath with backticks can be awkward in PS; fall back to JSON parse
if (-not $listenerArn) {
  $listeners = Aws-Json @("elbv2", "describe-listeners", "--load-balancer-arn", $albArn)
  $http = $listeners.Listeners | Where-Object { $_.Port -eq 80 } | Select-Object -First 1
  if ($http) { $listenerArn = $http.ListenerArn }
}

if (-not $listenerArn) {
  $listenerArn = Aws-Text @(
    "elbv2", "create-listener",
    "--load-balancer-arn", $albArn,
    "--protocol", "HTTP",
    "--port", "80",
    "--default-actions", "Type=forward,TargetGroupArn=$tgWeb",
    "--query", "Listeners[0].ListenerArn"
  )
  Write-Host "    Created listener"
} else {
  & aws elbv2 modify-listener --region $Region --listener-arn $listenerArn --default-actions "Type=forward,TargetGroupArn=$tgWeb" | Out-Null
  Write-Host "    Reusing listener"
}

$rules = Aws-Json @("elbv2", "describe-rules", "--listener-arn", $listenerArn)
foreach ($rule in $rules.Rules) {
  if (-not $rule.IsDefault) {
    & aws elbv2 delete-rule --region $Region --rule-arn $rule.RuleArn 2>$null | Out-Null
  }
}

& aws elbv2 create-rule --region $Region --listener-arn $listenerArn --priority 10 `
  --conditions "Field=path-pattern,Values=/api/*" `
  --actions "Type=forward,TargetGroupArn=$tgApi" | Out-Null

& aws elbv2 create-rule --region $Region --listener-arn $listenerArn --priority 20 `
  --conditions "Field=path-pattern,Values=/predict*" `
  --actions "Type=forward,TargetGroupArn=$tgModel" | Out-Null

function Attach-Service([string]$Service, [string]$TgArn, [string]$Container, [int]$Port) {
  Write-Host "==> Attaching ECS service $Service -> ${Container}:${Port}"
  $desc = Aws-Json @("ecs", "describe-services", "--cluster", $Cluster, "--services", $Service)
  $s = $desc.services[0]
  $desired = [int]$s.desiredCount
  if ($desired -lt 1) { $desired = 1 }
  $taskDef = $s.taskDefinition
  $subnetCsv = ($subnets -join ",")
  $sgCsv = ($taskSgs -join ",")
  $netCfg = "awsvpcConfiguration={subnets=[$subnetCsv],securityGroups=[$sgCsv],assignPublicIp=$assignPublicIp}"
  $lb = "targetGroupArn=$TgArn,containerName=$Container,containerPort=$Port"

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & aws ecs update-service `
    --region $Region `
    --cluster $Cluster `
    --service $Service `
    --task-definition $taskDef `
    --desired-count $desired `
    --health-check-grace-period-seconds 120 `
    --load-balancers $lb `
    --network-configuration $netCfg `
    --force-new-deployment 2>$null | Out-Null
  $ok = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $prev

  if ($ok) {
    Write-Host "    Updated $Service with load balancer"
    return
  }

  Write-Host "    Recreating service $Service..."
  & aws ecs delete-service --region $Region --cluster $Cluster --service $Service --force | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $st = Try-AwsText @("ecs", "describe-services", "--cluster", $Cluster, "--services", $Service, "--query", "services[0].status")
    if (-not $st -or $st -eq "INACTIVE") { break }
  }

  & aws ecs create-service `
    --region $Region `
    --cluster $Cluster `
    --service-name $Service `
    --task-definition $taskDef `
    --desired-count $desired `
    --launch-type FARGATE `
    --platform-version LATEST `
    --health-check-grace-period-seconds 120 `
    --network-configuration $netCfg `
    --load-balancers $lb `
    --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50" | Out-Null

  Write-Host "    Recreated $Service"
}

Attach-Service $WebService $tgWeb "churn-web" 80
Attach-Service $ApiService $tgApi "churn-api" 3000
Attach-Service $ModelService $tgModel "churn-model-service" 8000

$outPath = Join-Path $PSScriptRoot "alb-outputs.env"
@"
ALB_DNS=$albDns
ALB_URL=http://$albDns
MODEL_SERVICE_URL=http://$albDns
FRONTEND_URL=http://$albDns
AWS_REGION=$Region
CLUSTER=$Cluster
TG_WEB_ARN=$tgWeb
TG_API_ARN=$tgApi
TG_MODEL_ARN=$tgModel
ALB_ARN=$albArn
"@ | Set-Content -Path $outPath -Encoding utf8

Write-Host ""
Write-Host "============================================================"
Write-Host " PERMANENT PLATFORM URL (submit this):"
Write-Host " http://$albDns"
Write-Host "============================================================"
Write-Host " Routing:"
Write-Host "   http://$albDns/          -> churn-web"
Write-Host "   http://$albDns/api/*     -> churn-api"
Write-Host "   http://$albDns/predict*  -> churn-model-service"
Write-Host ""
Write-Host " Next:"
Write-Host "   1. Set GitHub secret MODEL_SERVICE_URL=http://$albDns"
Write-Host "   2. Push to main (or re-run the deploy workflow)"
Write-Host " Outputs: $outPath"
Write-Host "============================================================"
