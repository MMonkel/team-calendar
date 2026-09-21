# Team S planning

Team-kalender voor Team S: dag/week/maandoverzicht, verlofaanvragen met
vervangers per dagdeel, en een goedkeuringsflow voor Alexandra en Marc.
React-frontend en Node/Express-API in Ã©Ã©n container op Azure Container Apps,
met Postgres als opslag. Infrastructuur staat als Terraform in dezelfde repo
en wordt uitgerold door GitHub Actions.

Zie [docs/team-s.md](docs/team-s.md) voor de functionele spelregels (rooster,
aanvraagstatussen, wie wat mag) en wat er nog naar echte inlog (Entra ID) moet.

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

## Login: nu een placeholder, straks Entra ID

De app vraagt nu bij elk verzoek wie je bent via een header (`x-user`) die de
frontend zet op basis van een simpele personenkiezer â€” er wordt niets
geverifieerd. Dat is bewust zo gehouden om het rooster, de aanvragen en de
goedkeuringsflow te kunnen bouwen en testen zonder eerst een hele
inlogketen op te tuigen.

Voor een echte uitrol moet dit vervangen worden door Microsoft Entra ID:
* de frontend haalt met MSAL een id-token op voor de API;
* `api/src/middleware/auth.ts` valideert dat token tegen Entra's JWKS-endpoint
  in plaats van de `x-user`-header te vertrouwen.

Zolang dat niet is aangesloten, kan iedereen met toegang tot de app zich
voordoen als wie dan ook â€” inclusief als admin. Zie de `TODO Entra ID`-comments
in `api/src/middleware/auth.ts` en `web/src/lib/api.ts` voor de precieze plek.

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

## Volgende stappen

- Entra ID-login aansluiten (zie hierboven) â€” dit is de belangrijkste voor een
  echte uitrol.
- Eigen domein en certificaat op de Container App.
- Een tweede omgeving: `terraform workspace` of een aparte tfvars per omgeving,
  met een `prod`-environment in GitHub die een reviewer vereist.
- E-mailnotificatie naar Alexandra/Marc bij een nieuwe aanvraag, en naar de
  aanvrager bij een beslissing.
