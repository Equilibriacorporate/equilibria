# Hospedagem do Equilibria

O app está pronto para hospedar como aplicação Node.js.

## Opção recomendada para começar: Render

1. Crie uma conta em Render.
2. Crie um novo **Web Service**.
3. Conecte o repositório do projeto.
4. O arquivo `render.yaml` já define:
   - comando de start;
   - health check;
   - variáveis principais;
   - disco persistente para `data/equilibria-db.json`.
5. Após o deploy, abra a URL pública gerada pela Render.

## Opção Railway

1. Crie um projeto no Railway.
2. Conecte o repositório.
3. O arquivo `railway.json` já define start e health check.
4. Configure as variáveis:

```text
PORT=5290
HOST=0.0.0.0
SESSION_TTL_MS=28800000
MIN_TEAM_SAMPLE=3
```

Para produção real, adicione volume persistente ou migre para PostgreSQL.

## Opção Docker/VPS

Build:

```bash
docker build -t equilibria .
```

Run:

```bash
docker run -d --name equilibria -p 5290:5290 -v equilibria-data:/app/data equilibria
```

Abrir:

```text
http://SEU_SERVIDOR:5290
```

## Variáveis

```text
PORT=5290
HOST=0.0.0.0
SESSION_TTL_MS=28800000
MIN_TEAM_SAMPLE=3
```

## Aviso importante

Esta configuração publica o app atual com banco em arquivo. Para produção com muitos clientes, use PostgreSQL, HTTPS, backups automáticos, e-mail transacional e pagamento.
