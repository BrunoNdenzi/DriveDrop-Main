Write-Host "`n🔍 Testing Email After Redeploy..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

try {
    $response = Invoke-WebRequest `
        -Uri "https://drivedrop-main-production.up.railway.app/api/v1/emails/send-welcome" `
        -Method POST `
        -Body '{"email":"brunondenzi80@gmail.com","firstName":"Bruno","lastName":"Ndenzi","role":"driver"}' `
        -ContentType "application/json" `
        -UseBasicParsing
    
    Write-Host "`n✅ API Response: $($response.StatusCode)" -ForegroundColor Green
    $content = $response.Content | ConvertFrom-Json
    Write-Host "   Message: $($content.data.message)" -ForegroundColor White
    
    Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Check Railway logs for this message:" -ForegroundColor White
    Write-Host "      ✅ Email sent: driver_welcome to brunondenzi80@gmail.com" -ForegroundColor Green
    Write-Host "      (NOT '📧 Email would be sent')" -ForegroundColor Red
    Write-Host "`n   2. If you still see '📧 Email would be sent':" -ForegroundColor White
    Write-Host "      → BREVO_ENABLED is STILL not 'true'" -ForegroundColor Red
    Write-Host "      → Check the exact value on Railway Variables tab" -ForegroundColor Red
    Write-Host "      → Make sure it's in Production environment" -ForegroundColor Red
    Write-Host "`n   3. If you see '✅ Email sent':" -ForegroundColor White
    Write-Host "      → Check your Gmail inbox (brunondenzi80@gmail.com)" -ForegroundColor Green
    Write-Host "      → Check spam folder" -ForegroundColor Green
    Write-Host "      → Check Brevo dashboard at app.brevo.com" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
}

Write-Host "`n" -NoNewline
