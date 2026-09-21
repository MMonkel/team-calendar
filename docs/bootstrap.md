# Eenmalige setup

Je hebt de Azure CLI, de GitHub CLI en Terraform nodig, plus Owner- of
Contributor-rechten op de subscription.

> **Belangrijk: elk genummerd codeblok is één shell-sessie.** De commando's
> binnen een stap hergebruiken variabelen (`$REPO`, `$APP_ID`, `$SUB_ID`,
> `$TENANT_ID`, `$SUB_PREFIX`) die eerder in datzelfde blok zijn gezet. Plak
> een heel blok in één keer in hetzelfde terminalvenster. Open je een nieuw
> terminalvenster of een nieuwe SSH-sessie halverwege, dan zijn die
> variabelen weer leeg — een commando als `--id $APP_ID` faalt dan met een
> foutmelding als `argument --id: expected one argument`, of erger: als de
> variabele toevallig al iets anders bevat, voert het commando stilzwijgend
> iets uit op de verkeerde resource. Twijfel je of een variabele nog goed
> staat? Doe dan `echo "$APP_ID"` en controleer het antwoord voordat je verder gaat.

```bash
az login
az account set --subscription "<subscription-id>"
```

## 1. Opslag voor de Terraform-state

Terraform moet zijn state ergens bewaren waar de pipeline erbij kan. Deze
resources beheer je bewust niet met Terraform zelf.

```bash
LOCATION=swedencnetral
SA_NAME="sttfstate$RANDOM$RANDOM"   # moet globaal uniek zijn

az group create --name rg-tfstate --location $LOCATION

az storage account create \
  --name "$SA_NAME" --resource-group rg-tfstate --location $LOCATION \
  --sku Standard_LRS --allow-blob-public-access false --min-tls-version TLS1_2

az storage container create \
  --name tfstate --account-name "$SA_NAME" --auth-mode login

echo "Zet dit in infra/providers.tf: storage_account_name = \"$SA_NAME\""
```

## 2. App registration met federated credentials

Zo logt GitHub Actions in bij Azure zonder dat er een wachtwoord in GitHub staat:
Azure vertrouwt tokens die GitHub uitgeeft voor precies deze repo.

> **Let op — immutable subject claims.** Sinds medio 2026 stuurt GitHub voor
> elke repo die na 15 juli 2026 is aangemaakt (of nadien hernoemd/overgedragen)
> het OIDC-subject met onveranderlijke owner- en repo-ID's erin verwerkt:
> `repo:OWNER@OWNER-ID/REPO@REPO-ID:...` in plaats van alleen
> `repo:OWNER/REPO:...`. Oudere repo's die niet zijn hernoemd, gebruiken nog
> het oude, naam-gebaseerde formaat. Het onderstaande script vraagt het juiste
> prefix rechtstreeks bij GitHub op, zodat je niet hoeft te raden welk
> formaat jouw repo gebruikt.
>
> Klopt de federated credential niet met wat GitHub daadwerkelijk stuurt, dan
> faalt de 'azure/login'-stap met **AADSTS700213: No matching federated
> identity record found**. De foutmelding toont dan het exacte subject dat
> GitHub probeerde te gebruiken — dat kun je ook direct overnemen als het
> onderstaande script om wat voor reden dan ook het verkeerde formaat oplevert.

```bash
REPO="<org>/<repo>"
SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

APP_ID=$(az ad app create --display-name "gh-$REPO" --query appId -o tsv)
az ad sp create --id "$APP_ID"

# Toegang tot de subscription. Contributor volstaat voor de app-resources;
# voor het toekennen van de AcrPull-rol is daarnaast User Access Administrator nodig.
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUB_ID"
az role assignment create --assignee "$APP_ID" --role "User Access Administrator" \
  --scope "/subscriptions/$SUB_ID"

# Vraagt bij GitHub zelf op welk subject-prefix deze repo gebruikt: met
# immutable-ID's (repo:OWNER@ID/REPO@ID) of het oude, naam-gebaseerde
# formaat. Valt terug op het oude formaat als de call niet lukt (bijvoorbeeld
# een te oude gh-versie, of geen toegang tot deze endpoint).
SUB_PREFIX=$(gh api "repos/$REPO/actions/oidc/customization/sub" \
  --jq .sub_claim_prefix 2>/dev/null || echo "repo:$REPO")
echo "OIDC subject-prefix voor deze repo: $SUB_PREFIX"

# Eén credential per trigger: de environment 'dev' en pull requests.
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"gh-env-dev\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"$SUB_PREFIX:environment:dev\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"gh-pull-request\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"$SUB_PREFIX:pull_request\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"
```

## 3. Secrets in GitHub

```bash
gh secret set AZURE_CLIENT_ID --body "$APP_ID"
gh secret set AZURE_TENANT_ID --body "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --body "$SUB_ID"
```

Maak in GitHub onder Settings → Environments een environment `dev`. Wil je elke
infra-wijziging zelf goedkeuren, zet daar dan een required reviewer op.

## 4. Infrastructuur aanmaken

Push je code en start de Infra-workflow, of draai lokaal:

```bash
cd infra
terraform init
terraform apply
```

De eerste apply zet een placeholder-image in de Container App. Dat is normaal.
Er wordt ook een Postgres-server en een Key Vault aangemaakt; de connectiestring
komt automatisch in Key Vault terecht en de Container App krijgt er via zijn
managed identity leestoegang toe. De databasetabel zelf wordt niet door
Terraform aangemaakt — dat gebeurt idempotent bij elke container-start (zie
`Dockerfile`), dus de eerste echte deploy zet ook meteen het schema neer.

## 5. Outputs als variables in GitHub

```bash
gh variable set ACR_LOGIN_SERVER --body "$(terraform output -raw container_registry)"
gh variable set CONTAINER_APP_NAME --body "$(terraform output -raw container_app_name)"
gh variable set RESOURCE_GROUP --body "$(terraform output -raw resource_group_name)"
```

## 6. Deployen

Push naar `main`. De Deploy-workflow bouwt het image, pusht het naar ACR en rolt
een nieuwe revisie uit. De URL van de app staat in de samenvatting van de run, en
in `terraform output app_url`.

## Problemen oplossen: AADSTS700213

Krijg je in de Deploy- of Infra-workflow de foutmelding **AADSTS700213: No
matching federated identity record found**, dan verwacht Azure een ander
subject dan GitHub nu daadwerkelijk stuurt — meestal omdat de credential is
aangemaakt vóórdat de repo overstapte op het immutable-subjectformaat (zie de
uitleg bij stap 2). Los het op door de bestaande credentials bij te werken
naar het huidige subject-prefix:

```bash
REPO="<org>/<repo>"
```

Controleer eerst of er precies één App Registration met deze naam bestaat,
vóórdat je blind op `[0]` vertrouwt:

```bash
az ad app list --display-name "gh-$REPO" --query "[].{name:displayName, appId:appId}" -o table
```

Staat hier meer dan één rij, ga dan eerst naar
["Twee App Registrations door elkaar"](#twee-app-registrations-door-elkaar)
hieronder — anders werk je zo meteen de verkeerde credential bij. Staat er
precies één rij, ga verder:

```bash
APP_ID=$(az ad app list --display-name "gh-$REPO" --query "[0].appId" -o tsv)
SUB_PREFIX=$(gh api "repos/$REPO/actions/oidc/customization/sub" \
  --jq .sub_claim_prefix 2>/dev/null || echo "repo:$REPO")
echo "APP_ID=$APP_ID"
echo "SUB_PREFIX=$SUB_PREFIX"

az ad app federated-credential update --id "$APP_ID" --federated-credential-id gh-env-dev \
  --parameters "{
    \"name\": \"gh-env-dev\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$SUB_PREFIX:environment:dev\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

az ad app federated-credential update --id "$APP_ID" --federated-credential-id gh-pull-request \
  --parameters "{
    \"name\": \"gh-pull-request\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$SUB_PREFIX:pull_request\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
```

Komt `SUB_PREFIX` er toch verkeerd uit (bijvoorbeeld door een oudere `gh`-versie
zonder toegang tot deze endpoint), kopieer dan het exacte subject uit de
foutmelding zelf — die toont precies wat GitHub verstuurde — en vul dat
handmatig in bij `--parameters`.

### Twee App Registrations door elkaar

Blijft AADSTS700213 optreden nadat de credential aantoonbaar goed staat, dan
gebruikt GitHub waarschijnlijk een andere App Registration dan degene die je
zojuist bijwerkte. Dit gebeurt makkelijk als stap 2 een tweede keer is
gedraaid terwijl `$REPO` per ongeluk al een andere waarde bevatte (bijvoorbeeld
de output van een eerdere `$SUB_PREFIX`-toewijzing in dezelfde sessie) — dan
maakt `az ad app create --display-name "gh-$REPO"` een gloednieuwe, verkeerd
genoemde app aan in plaats van de bestaande te hergebruiken.

Alleen de **oorspronkelijke** app heeft de rol-toekenningen (Contributor en
User Access Administrator) die Terraform en de deploy nodig hebben; een per
ongeluk aangemaakte tweede app heeft die niet. Zoek 'm zo op:

```bash
az ad app list --display-name "gh-$REPO" --query "[].{name:displayName, appId:appId}" -o table

# Voor elke appId uit de lijst hierboven:
az role assignment list --assignee "<appId>" -o table
```

De app die hier zowel Contributor als User Access Administrator toont, is de
juiste. Werk daarop de federated credentials bij (zie hierboven), en zet
`AZURE_CLIENT_ID` expliciet op die appId:

```bash
gh secret set AZURE_CLIENT_ID --body "<de-juiste-appId>"
```

De overige, ongebruikte app-registraties kun je laten staan (ze doen niets)
of opruimen met `az ad app delete --id "<appId>"`.

## Opruimen

```bash
cd infra && terraform destroy
az group delete --name rg-tfstate --yes
az ad app delete --id "$APP_ID"
```
