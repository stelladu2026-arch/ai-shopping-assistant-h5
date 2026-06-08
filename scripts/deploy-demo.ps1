#Requires -Version 5.1
<#
  一键部署到 Vercel（演示环境，使用本地 Mock，无需 Coze 密钥）
  用法（在项目根目录）:
    npm run deploy:demo
  或:
    .\scripts\deploy-demo.ps1

  首次运行会打开浏览器登录 Vercel；完成后终端会输出可分享的 https://xxx.vercel.app 链接。
  若已有 VERCEL_TOKEN 环境变量，可免登录。
#>
param(
  [switch]$Preview
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

Write-Host ""
Write-Host "AI导购助手 H5 — 部署到 Vercel（演示 Mock 模式）" -ForegroundColor Cyan
Write-Host "环境变量 COZE_WORKFLOW_USE_MOCK=1 已在 vercel.json 中配置" -ForegroundColor DarkGray
Write-Host ""

if ($env:VERCEL_TOKEN -and $env:VERCEL_TOKEN.Trim().Length -lt 24) {
  Write-Host "检测到无效的 VERCEL_TOKEN 环境变量，已临时忽略（请改用 vercel login）" -ForegroundColor Yellow
  Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue
}

$vercelArgs = @("vercel", "--yes")
if (-not $Preview) {
  $vercelArgs += "--prod"
}

Write-Host "执行: npx $($vercelArgs -join ' ')" -ForegroundColor DarkGray
Write-Host ""

& npx @vercelArgs
if ($LASTEXITCODE -ne 0) {
  throw "Vercel 部署失败（退出码 $LASTEXITCODE）。若未登录，请先运行: npx vercel login"
}

Write-Host ""
Write-Host "部署完成。请将终端输出的 Production / Preview URL 发给面试官。" -ForegroundColor Green
Write-Host "建议附带：首页 / 、对话 /chat 、会话中心 /sessions" -ForegroundColor DarkGray
Write-Host ""
