# Equilibria

Sistema de gestão emocional corporativa para check-ins diários, leitura de clima, alertas preventivos, relatórios e simulação comercial.

## Como executar

No Windows, você pode dar dois cliques em `iniciar.bat`.

Use Node.js e rode:

```bash
npm start
```

Depois acesse:

```text
http://127.0.0.1:5290
```

Contas demo:

- colaborador@equilibria.demo
- rh@equilibria.demo
- admin@equilibria.demo

Senha demo:

```text
demo123
```

Para recriar a base demo:

```bash
npm run reset-demo
```

## O que já está pronto

- Check-in e check-out emocional.
- Indicadores de humor, energia, pressão, apoio e risco.
- Relatório pessoal privado.
- Dashboard agregado para RH e liderança.
- Visão por equipe com dados anonimizados.
- Plano de intervenções preventivas.
- IA de apoio simulada, com limite claro de não diagnóstico.
- Planos comerciais e simulador de receita.
- Exportação do relatório para a área de transferência.
- Backend local em Node.js sem dependências externas.
- API REST para login, dashboard, check-ins, relatórios, IA simulada e exportação.
- Cadastro real de empresa.
- Criação de usuários por RH/Admin.
- Registro de consentimento por check-in.
- Hash forte de novas senhas com scrypt.
- Rate limit básico no login.
- Sessões com expiração.
- Cabeçalhos HTTP de segurança.
- Proteção de amostra mínima em relatórios por equipe.
- Dados persistidos em `data/equilibria-db.json`.

## Limites do MVP

Este MVP é uma demonstração executável com backend local. Para venda como SaaS real em produção, os próximos passos são:

- banco de dados gerenciado;
- autenticação com recuperação de senha e convites;
- painel administrativo;
- gestão de empresas e colaboradores;
- logs de consentimento;
- criptografia e controle de acesso;
- integração com pagamento;
- revisão jurídica e LGPD;
- integração futura com profissionais de saúde ou parceiros.

## Posicionamento

O Equilibria não diagnostica doenças e não substitui atendimento psicológico, médico ou emergencial. A plataforma ajuda empresas a acompanhar sinais emocionais agregados, apoiar colaboradores e agir preventivamente sobre riscos organizacionais.

## Produção

Leia `PRODUCAO.md` para o checklist de transformação em SaaS hospedado com banco gerenciado, pagamentos, segurança e LGPD.

## Hospedagem

Leia `HOSPEDAGEM.md`. O projeto já inclui `render.yaml`, `railway.json`, `Dockerfile` e `Procfile`.

## Guia rápido

Leia `APP_PRONTO.md` para usar a aplicação em uma operação local ou piloto.
