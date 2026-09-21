# Eenmalige setup

Je hebt de Azure CLI, de GitHub CLI en Terraform nodig, plus Owner- of
Contributor-rechten op de subscription.

```bash
az login
az account set --subscription "<subscription-id>"
```

## 1. Opslag voor de Terraform-state

Terraform moet zijn state ergens bewaren waar de pipeline erbij kan. Deze
resources beheer je bewust niet met Terraform zelf.

```bash
LOCATION=swedencentral
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

```bash
REPO="<org>/<repo>"
APP_ID=$(az ad app list --display-name "gh-$REPO" --query "[0].appId" -o tsv)
SUB_PREFIX=$(gh api "repos/$REPO/actions/oidc/customization/sub" \
  --jq .sub_claim_prefix 2>/dev/null || echo "repo:$REPO")

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

## Opruimen

```bash
cd infra && terraform destroy
az group delete --name rg-tfstate --yes
az ad app delete --id "$APP_ID"
```
