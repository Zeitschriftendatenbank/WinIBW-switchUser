param(
    [string]$file
)

$encrypted = Get-Content $file
$secure = ConvertTo-SecureString $encrypted
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

Write-Output $plain