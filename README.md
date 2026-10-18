# Team S planning

Team-kalender voor Team S: dag/week/maandoverzicht, verlofaanvragen met
vervangers per dagdeel, en een goedkeuringsflow voor Alexandra en Marc.
React-frontend en Node/Express-API in Ã©Ã©n container op Azure Container Apps,
met Postgres als opslag. Infrastructuur staat als Terraform in dezelfde repo
en wordt uitgerold door GitHub Actions.

Zie [docs/team-s.md](docs/team-s.md) voor de functionele spelregels (rooster,
aanvraagstatussen, wie wat mag) en wat er nog niet af is.

## Wat er in zit

```
shared/   Domeinlogica die api Ã©n web gebruiken: rooster, feestdagen, aanvraagregels
api/      Express-API in TypeScript + Postgres
web/      React + Vite frontend
infra/    Terraform: resource group, ACR, Container App, Postgres, Key Vault, App Insights
.github/  CI (typecheck, build), infra (plan/apply), deploy (build, push, uitrollen)
docs/     Eenmalige setup van Azure en GitHub, en de functionele spelregels
```

`shared/` bestaat zodat de regels van het rooster (wie werkt wanneer, welke
feestdagen, de 3-maandenwaarschuwing) maar op Ã©Ã©n plek staan. De API gebruikt
ze om aanvragen te valideren; de frontend gebruikt dezelfde functies om
bijvoorbeeld direct te tonen welke dagdelen je kunt overdragen, zonder een
rondje naar de server.

Frontend en API zitten bewust in Ã©Ã©n container: dat scheelt CORS, een tweede
deploy-pipeline en een extra resource.

## Lokaal draaien

```bash
docker compose up -d                        # Postgres op :5432
cp api/.env.example api/.env
npm install
npm run migrate --workspace=api             # tabel aanmaken
npm run dev                                 # API op :8080, frontend op :5173
```

Of precies zoals in productie (migratie draait dan automatisch bij het opstarten):

```bash
docker build -t team-s .
docker run --rm -p 8080:8080 --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL=postgres://appuser:apppassword@host.docker.internal:5432/teams \
  team-s
```

## Eerste keer uitrollen

Volg [docs/bootstrap.md](docs/bootstrap.md). Kort samengevat:

1. Storage account voor de Terraform-state aanmaken en invullen in `infra/providers.tf`.
2. App registration met federated credentials maken, zodat GitHub Actions zonder
   wachtwoord bij Azure kan.
3. `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` en `AZURE_SUBSCRIPTION_ID` als secrets in
   GitHub zetten.
4. De Infra-workflow draaien. Die maakt resource group, ACR, Postgres, Key Vault
   en de Container App aan (met een placeholder-image).
5. De outputs (`container_registry`, `container_app_name`, `resource_group_name`)
   als repository variables in GitHub zetten.
6. Pushen naar `main`; de Deploy-workflow bouwt het echte image en rolt het uit.
   De container maakt bij het opstarten zelf de databasetabel aan (idempotent).

## Hoe een wijziging live komt

Pull request â†’ CI draait typecheck, build en een docker build â†’ na merge naar
`main` bouwt Deploy een image met de commit-SHA als tag, pusht die naar ACR en
zet een nieuwe revisie van de Container App live. Terugrollen is `az containerapp
update` met een oudere SHA.

Wijzigingen in `infra/` gaan via de Infra-workflow: op een PR zie je het plan, na
merge wordt het toegepast. Terraform negeert bewust het `image`-veld van de
Container App, zodat een infra-apply een lopende deploy niet terugdraait.

## Eigen domein

De app draait op `teams.monkel.com` (variabele `custom_domain` in
`infra/variables.tf`). De DNS van monkel.com staat bij ZoneEdit, dus de records
zet je daar met de hand:

* `CNAME teams` → output `custom_domain_cname_target`
* `TXT asuid.teams` → output `custom_domain_verification_id`

De records moeten bestaan vóór de apply, anders weigert Azure de hostnaam.
Terraform voegt alleen de hostnaam toe. Het gratis managed certificaat koppel je
daarna één keer zelf, en Azure verlengt het daarna automatisch:

```
az containerapp hostname bind --hostname teams.monkel.com \
  --name ca-starter-dev --resource-group rg-starter-dev \
  --environment cae-starter-dev --validation-method CNAME
```

## Login: Entra ID

In Azure kom je alleen bij de app na inloggen met Microsoft Entra ID. Dat doet
de ingebouwde authenticatie van Container Apps (`azapi_resource.auth` in
`infra/main.tf`), vóór de app. De API leest wie er is ingelogd uit de
`X-MS-CLIENT-PRINCIPAL`-header die het platform meestuurt en die een browser
niet zelf kan zetten, en koppelt het e-mailadres aan een teamlid
(`api/src/middleware/auth.ts`). Alleen `/api/health` is zonder login bereikbaar.

Lokaal draait er geen login (`APP_ENV` niet gezet): dan kies je met de
personenkiezer wie je bent, via de `x-user`-header. In Azure negeert de API die
header.

Wat buiten Terraform staat, omdat de GitHub Actions-identity geen rechten in
Entra heeft:

* **App registration** "Team S planning" (client ID in `entra_client_id`), met
  redirect-URI `https://teams.monkel.com/.auth/login/aad/callback`.
* **Key Vault-secret `entra-client-secret`**: het client secret van die app
  registration. Het verloopt op 17 oktober 2028. Vernieuwen:
  ```
  az ad app credential reset --id <client-id> --display-name container-app-auth --years 2 \
    --query password -o tsv | tr -d '\r\n' \
    | az keyvault secret set --vault-name kv-starter-dev-loe70 --name entra-client-secret --file /dev/stdin
  ```
* **Key Vault-secret `team-emails`**: welk e-mailadres bij welk teamlid hoort,
  als JSON, bijvoorbeeld `{"Marc": "marc@monkel.com", "Nicole": ["a@x.nl", "b@y.nl"]}`.
  Dit staat niet in de code omdat de repo publiek is. Na een wijziging een
  nieuwe revisie starten (`az containerapp revision restart`) zodat de app het
  oppikt.
* **Gastuitnodigingen**: elk teamlid wordt als gast uitgenodigd in de tenant,
  met hetzelfde adres als in `team-emails`. Inloggen gaat daarna met hun eigen
  Microsoft-account of met een eenmalige code per mail.

## E-mail

Bij een nieuwe aanvraag (vrije dag, vakantie, verplaatsing of terugzetten)
krijgen Alexandra en Marc een mail; is de aanvrager zelf een van hen, dan alleen
de ander. Bij goedkeuren of afkeuren krijgt de aanvrager een mail, behalve als
die zelf de beslissing nam. Adressen komen uit `team-emails` (zie "Login"). De
code staat in `api/src/notifications.ts`; een mislukte mail wordt gelogd en
blokkeert nooit de aanvraag.

Versturen gaat via Azure Communication Services (`infra/email.tf`) vanaf
`noreply@planning.monkel.com`, met de managed identity van de app. Dat is een
apart subdomein omdat op `teams.monkel.com` al de CNAME van de app staat, en een
naam met een CNAME geen TXT-records ernaast mag hebben. Het domein moet eerst
geverifieerd zijn, dus de eerste keer gaat het in twee stappen:

1. Apply met `email_domain_verified = false` (de standaard). De output
   `email_dns_records` geeft de records die in ZoneEdit moeten: een TXT voor
   verificatie, een TXT voor SPF en twee CNAME's voor DKIM.
2. Records zetten, dan per type verifiëren:
   ```
   for t in Domain SPF DKIM DKIM2; do
     az communication email domain initiate-verification --domain-name planning.monkel.com \
       --email-service-name ecs-starter-dev --resource-group rg-starter-dev --verification-type $t
   done
   ```
3. Als alle vier `Verified` zijn, `email_domain_verified` op `true` zetten en
   pushen. Dan koppelt Terraform het domein en krijgt de app `ACS_ENDPOINT`;
   zonder die variabele verstuurt de app niets en logt hij alleen.

## Database

E©n tabel (`requests`) met alle drie de aanvraagtypes (vrije
dag/vakantie, verplaatsing, terugzetten) â€” zie `api/src/db/schema.sql`. De
migratie is idempotent (`create table if not exists`) en draait automatisch bij
elke container-start, dus een nieuwe kolom toevoegen is: schema.sql aanpassen,
committen, deployen.

De connectiestring staat in Key Vault; de Container App leest hem via zijn
managed identity, nooit als platte omgevingsvariabele in Terraform-state of
GitHub.

## Kosten

Container Apps rekent per verbruik. Met `min_replicas = 0` schaalt de app naar nul
als er geen verkeer is. Postgres Flexible Server draait op de kleinste burstable
SKU (`B_Standard_B1ms`); dat is samen met ACR Basic, Log Analytics en Key Vault
in de orde van een paar tientjes per maand voor een team van deze omvang.

Er staat een maandbudget van €10 op de subscription (`infra/budget.tf`,
variabele `monthly_budget_eur`). De Owner van de subscription krijgt een mail
als Azure verwacht dat de maand daarboven uitkomt, en als de werkelijke kosten
80% en 100% halen. Een budget waarschuwt alleen: er wordt niets uitgezet.

## Volgende stappen

- Een tweede omgeving: `terraform workspace` of een aparte tfvars per omgeving,
  met een `prod`-environment in GitHub die een reviewer vereist.
