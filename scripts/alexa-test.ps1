param(
  [Parameter(Mandatory)][ValidateSet('bg', 'iob', 'cob', 'insulina', 'carbos')][string]$Teste,
  [string]$Valor = '1',
  [string]$Token = $env:NS_ALEXA_TOKEN,
  [string]$BaseUrl = 'https://nightscout-gabriel-dev.fly.dev',
  [string]$SkillId = 'amzn1.ask.skill.b76aee89-6b6b-407c-8f7d-7431d0688fa4',
  [switch]$SoJson
)

if (-not $Token -and -not $SoJson) { throw 'Informe -Token ou defina a variavel NS_ALEXA_TOKEN.' }

function New-Metric($name) {
  @{ metric = @{ name = 'metric'; value = $name
      resolutions = @{ resolutionsPerAuthority = @(@{ status = @{ code = 'ER_SUCCESS_MATCH' }
            values = @(@{ value = @{ name = $name; id = $name } }) }) } } }
}

switch ($Teste) {
  { $_ -in 'bg', 'iob', 'cob' } { $intent = 'MetricNow'; $slots = New-Metric $Teste; $confirm = 'NONE' }
  'insulina' { $intent = 'RecordInsulin'; $slots = @{ units = @{ name = 'units'; value = $Valor } }; $confirm = 'CONFIRMED' }
  'carbos' { $intent = 'RecordCarbs'; $slots = @{ grams = @{ name = 'grams'; value = $Valor } }; $confirm = 'CONFIRMED' }
}

$body = @{
  version = '1.0'
  session = @{ new = $true; sessionId = "amzn1.echo-api.session.$([guid]::NewGuid())"
    application = @{ applicationId = $SkillId }; user = @{ userId = 'teste' } }
  context = @{ System = @{ application = @{ applicationId = $SkillId } } }
  request = @{
    type = 'IntentRequest'; locale = 'pt-BR'
    requestId = "amzn1.echo-api.request.$([guid]::NewGuid())"
    timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    intent = @{ name = $intent; confirmationStatus = $confirm; slots = $slots }
  }
} | ConvertTo-Json -Depth 10

if ($SoJson) { $body | Set-Clipboard; Write-Host 'JSON copiado para a area de transferencia (valido por 150 s).'; return }

$r = Invoke-RestMethod -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -Uri "$BaseUrl/api/v1/alexa?token=$Token"
$r.response.outputSpeech.text
