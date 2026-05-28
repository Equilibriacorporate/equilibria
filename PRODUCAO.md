# Guia de produção

Esta versão já tem a estrutura de um SaaS local: backend, autenticação, empresas, usuários, check-ins, consentimentos, relatórios e frontend conectado por API.

Para operar em produção real, substitua os pontos abaixo.

## Infraestrutura

- Hospedar o backend em Render, Fly.io, Railway, AWS, Azure ou Google Cloud.
- Usar HTTPS obrigatório.
- Usar domínio próprio.
- Configurar variáveis de ambiente.
- Registrar logs de aplicação e erros.

## Banco de dados

O MVP usa `data/equilibria-db.json`. Em produção, trocar por:

- PostgreSQL para dados principais.
- Backups automáticos.
- Migrações versionadas.
- Criptografia em repouso.
- Política de retenção e exclusão de dados.

## Segurança

- Hash de senha forte com `scrypt` para novos usuários.
- Sessões com expiração configurável por `SESSION_TTL_MS`.
- Rate limit básico no login.
- Cabeçalhos HTTP de segurança, incluindo CSP, frame-ancestors, nosniff e permissions policy.
- Amostra mínima por equipe configurável por `MIN_TEAM_SAMPLE`.
- Próximo passo recomendado: trocar sessão em memória por Redis ou JWT assinado com rotação.
- Próximo passo recomendado: usar argon2id/bcrypt com biblioteca dedicada quando puder instalar dependências.
- Adicionar recuperação de senha.
- Criar convites por e-mail.
- Separar permissões de colaborador, gestor, RH e admin.
- Registrar consentimentos com versão do texto aceito.

## LGPD

- Política de privacidade.
- Termo de uso.
- Base legal definida para cada dado.
- Relatório individual privado por padrão.
- Dados coletivos anonimizados com mínimo de participantes por equipe.
- Canal para exclusão/exportação de dados do titular.
- Contrato de operador/controlador com empresas clientes.

## Pagamentos

- Integrar Stripe, Iugu, Asaas, Mercado Pago ou Pagar.me.
- Cobrança mensal por colaborador ativo.
- Controle de plano por empresa.
- Bloqueio ou downgrade por inadimplência.
- Nota fiscal conforme operação.

## Próximas implementações

- Painel de criação de empresas pelo time comercial.
- E-mails transacionais.
- Exportação PDF.
- Dashboards por período.
- Integração com Slack, Teams e e-mail.
- Auditoria avançada.
- IA real conectada a regras de segurança e base de conhecimento.

## Variáveis de ambiente

Copie `.env.example` para `.env` no ambiente de produção ou configure as variáveis direto na plataforma:

```text
PORT=5290
SESSION_TTL_MS=28800000
MIN_TEAM_SAMPLE=3
```

## Docker

Build:

```bash
docker build -t equilibria .
```

Run:

```bash
docker run --rm -p 5290:5290 equilibria
```

Em produção, monte um volume persistente para `/app/data` ou substitua o arquivo local por PostgreSQL.
