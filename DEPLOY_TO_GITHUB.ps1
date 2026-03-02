param ( [string]$RepoURL = "" )
Write-Host "🚀 Préparation du déploiement de SecureVote..." -ForegroundColor Cyan

# 1. Init
if (!(Test-Path .git)) { 
    git init 
}

# 2. Remote
if ($RepoURL -ne "") {
    git remote remove origin 2>$null
    git remote add origin $RepoURL
}

# 3. Add & Commit
git add .
git commit -m "🚀 Initial deploy for Render.com"

# 4. Push
if ($RepoURL -ne "") {
    git branch -M main
    git push -u origin main -f
    Write-Host "✅ Terminé ! Votre code est sur GitHub." -ForegroundColor Green
}
else {
    Write-Host "⚠️ Pas d'URL fournie." -ForegroundColor Yellow
}
