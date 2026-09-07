param([ValidateSet('status','capture')][string]$Action='status',[int]$TargetPid=0,[string]$ExpectedName='')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try {
 if($Action -eq 'status') {
  $apps=@(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object { @{pid=$_.Id;bundleId=$_.ProcessName;name=$_.MainWindowTitle;active=$false} })
  @{available=$true;apps=$apps;nativeAppAudio=$false;platform='win32';platformName='Windows'} | ConvertTo-Json -Depth 5 -Compress
 } else {
  $app=Get-Process -Id $TargetPid
  if($app.ProcessName -ne $ExpectedName -or $app.MainWindowHandle -eq 0){throw 'The app closed or restarted. Refresh the app list.'}
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $root=[System.Windows.Automation.AutomationElement]::FromHandle($app.MainWindowHandle)
  $nodes=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  $parts=New-Object 'System.Collections.Generic.List[string]'
  $seen=New-Object 'System.Collections.Generic.HashSet[string]'
  $length=0
  for($i=0;$i -lt [Math]::Min($nodes.Count,2000);$i++) {
   try {
    $node=$nodes.Item($i)
    if($node.Current.IsPassword -or $node.Current.IsOffscreen){continue}
    $pattern=$null;$text=''
    if($node.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern,[ref]$pattern)){$text=$pattern.DocumentRange.GetText(30000)}
    else {$text=$node.Current.Name}
    if($text -and $seen.Add($text)){$parts.Add($text);$length+=$text.Length}
    if($length -ge 100000){break}
   } catch {}
  }
  if($parts.Count -eq 0){throw 'This app does not expose readable text. Use its browser tab if available.'}
  @{title=$app.MainWindowTitle;text=($parts -join "`n`n");warnings=@('Windows accessibility text may omit content in custom or protected controls.')} | ConvertTo-Json -Depth 5 -Compress
 }
} catch { @{error=$_.Exception.Message} | ConvertTo-Json -Compress;exit 1 }
